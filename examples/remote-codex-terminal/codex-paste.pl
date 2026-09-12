#!/usr/bin/perl
# Source: https://github.com/adenta/omarchy-utilities/tree/main/examples/remote-codex-terminal
use strict;
use warnings;
use Cwd qw(abs_path);
use MIME::Base64 qw(decode_base64 encode_base64);
use POSIX qw(:termios_h);

# A short-lived background tmux window receives the OSC 52 reply. Clipboard
# bytes stay in memory and never arrive at the user's command prompt as input.
my ($action, $socket, $origin, $client) = @ARGV;
my $uid = $<;
die "Invalid clipboard request\n" unless defined($client)
  && $socket =~ m{\A/tmp/tmux-$uid/codex-remote-[a-zA-Z0-9-]+\z}
  && $origin =~ /\A%\d+\z/ && $client =~ m{\A/dev/pts/\d+\z};

sub tmux { system('/usr/bin/tmux', '-S', $socket, @_) == 0 }
sub output {
  open my $pipe, '-|', '/usr/bin/tmux', '-S', $socket, @_ or die "tmux unavailable\n";
  local $/;
  my $text = <$pipe> // '';
  close $pipe or die "tmux request failed\n";
  $text =~ s/\n\z//;
  return $text;
}
sub quote {
  my ($text) = @_;
  $text =~ s/'/'\\''/g;
  return "'$text'";
}
sub failed {
  tmux('set-option', '-s', '@codex_clipboard_disabled', '1');
  tmux('set-option', '-s', '@codex_clipboard_busy', '0');
  tmux('set-option', '-s', '@codex_clipboard_result', 'unavailable');
  tmux('display-message', '-c', $client, 'Clipboard unavailable; nothing pasted. Ctrl+Shift+V still works.');
}

if ($action eq 'start') {
  my $ok = eval {
    my $session = output('display-message', '-p', '-t', $origin, '#{session_id}');
    die "Missing originating session\n" unless $session =~ /\A\$\d+\z/;
    my $command = join(' ', map { quote($_) } '/usr/bin/perl', abs_path($0), 'receive', $socket, $origin, $client);
    tmux('new-window', '-d', '-t', "$session:", '-n', 'paste', $command) or die "Receiver unavailable\n";
    1;
  };
  failed() unless $ok;
  exit($ok ? 0 : 1);
}
die "Unknown clipboard request\n" unless $action eq 'receive';

my $term = POSIX::Termios->new();
$term->getattr(0);
my ($iflag, $oflag, $lflag) = ($term->getiflag(), $term->getoflag(), $term->getlflag());
$term->setiflag($iflag & ~(ICRNL | INLCR | IGNCR | IXON));
$term->setoflag($oflag & ~OPOST);
$term->setlflag($lflag & ~(ICANON | ECHO | ISIG | IEXTEN));
$term->setcc(VMIN, 1);
$term->setcc(VTIME, 0);
$term->setattr(0, TCSANOW);
binmode STDIN;
my $buffer = 'codex-paste-' . $$;
my $buffer_loaded = 0;
my ($old_set_clipboard, $old_get_clipboard);
sub restore_clipboard_policy {
  tmux('set-option', '-s', 'get-clipboard', $old_get_clipboard) if defined $old_get_clipboard;
  tmux('set-option', '-s', 'set-clipboard', $old_set_clipboard) if defined $old_set_clipboard;
}
my $ok = eval {
  my $receiver = $ENV{TMUX_PANE} // '';
  die "Invalid receiver\n" unless $receiver =~ /\A%\d+\z/;
  local $SIG{ALRM} = sub { die "Clipboard timeout\n"; };
  alarm 3;
  # tmux 3.7 routes application clipboard requests back to the requesting pane.
  # Use only this terminal's client, and allow queries only while receiving.
  my @clients = split /\n/, output('list-clients', '-F', '#{client_name}');
  die "Clipboard client changed\n" unless @clients == 1 && $clients[0] eq $client;
  $old_set_clipboard = output('show-options', '-s', '-v', 'set-clipboard');
  $old_get_clipboard = output('show-options', '-s', '-v', 'get-clipboard');
  tmux('set-option', '-s', 'set-clipboard', 'on') or die "Query unavailable\n";
  tmux('set-option', '-s', 'get-clipboard', 'request') or die "Query unavailable\n";
  local $| = 1;
  print STDOUT "\x1b]52;c;?\x07" or die "Cannot request clipboard\n";
  my $reply = '';
  while ($reply !~ /(?:\x07|\x1b\\)\z/) {
    my $read = sysread(STDIN, my $chunk, 65536);
    die "Clipboard reply ended\n" unless defined($read) && $read > 0;
    $reply .= $chunk;
    die "Clipboard too large\n" if length($reply) > 16 * 1024 * 1024;
  }
  alarm 0;
  restore_clipboard_policy();
  die "Invalid clipboard reply\n" unless $reply =~ /\A\x1b\]52;[^;\x07]*;([A-Za-z0-9+\/=]*)(?:\x07|\x1b\\)\z/;
  my $encoded = $1;
  my $text = decode_base64($encoded);
  die "Invalid clipboard encoding\n" unless encode_base64($text, '') eq $encoded;
  die "Origin closed\n" unless output('display-message', '-p', '-t', $origin, '#{pane_dead}') eq '0';
  if (length($text)) {
    open my $load, '|-', '/usr/bin/tmux', '-S', $socket, 'load-buffer', '-b', $buffer, '-' or die "Cannot load paste\n";
    binmode $load;
    print {$load} $text or die "Cannot load paste\n";
    close $load or die "Cannot load paste\n";
    $buffer_loaded = 1;
    tmux('paste-buffer', '-p', '-r', '-d', '-b', $buffer, '-t', $origin) or die "Paste failed\n";
    $buffer_loaded = 0;
  }
  tmux('set-option', '-s', '@codex_clipboard_result', 'ok');
  tmux('set-option', '-s', '@codex_clipboard_busy', '0');
  1;
};
alarm 0;
restore_clipboard_policy();
if (!$ok) {
  tmux('delete-buffer', '-b', $buffer) if $buffer_loaded;
  # After any failure, don't issue another query in this terminal: a late
  # response must never be mistaken for the result of a subsequent request.
  failed();
}
$term->setiflag($iflag);
$term->setoflag($oflag);
$term->setlflag($lflag);
$term->setattr(0, TCSANOW);
exit($ok ? 0 : 1);
