import pty
import os
import time
import sys
import select

HOST = os.environ.get("DEV_HOST", "65.109.205.239")
PASS = os.environ.get("DEV_PASS") or (sys.argv[1] if len(sys.argv) > 1 else "")
PUB_KEY = os.environ.get("SSH_PUB_KEY") or (sys.argv[2] if len(sys.argv) > 2 else "")

if not PASS:
    import getpass
    PASS = getpass.getpass(f"Enter root password for {HOST}: ")

if not PUB_KEY:
    default_key = os.path.expanduser("~/.ssh/id_ed25519.pub")
    if os.path.exists(default_key):
        with open(default_key, "r") as f:
            PUB_KEY = f.read().strip()
    else:
        print("Error: SSH_PUB_KEY environment variable or argument required.", file=sys.stderr)
        sys.exit(1)

CMDS = f"""
export TERM=xterm
echo "Logged in successfully"
whoami
echo "--> INSTALLING SSH KEY ON DEV"
mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo "{PUB_KEY}" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
echo "✅ DEV KEY INSTALLED"
cat /root/.ssh/authorized_keys
exit
"""

print(f"--- CONNECTING TO DEV {HOST} ---")
pid, fd = pty.fork()
if pid == 0:
    os.execvp("ssh", ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", f"root@{HOST}"])
else:
    password_sent = False
    cmds_sent = False
    buff = b""
    start = time.time()
    
    while True:
        if time.time() - start > 120:
             print("TIMEOUT")
             break
             
        r, w, e = select.select([fd], [], [], 1.0)
        if fd in r:
            try:
                data = os.read(fd, 1024)
                if not data: break
                buff += data
                sys.stdout.write(data.decode('utf-8', errors='ignore'))
                sys.stdout.flush()
                
                if (b"password:" in buff or b"passphrase" in buff) and not password_sent:
                    os.write(fd, (PASS + "\n").encode())
                    password_sent = True
                    buff = b""
                
                # More robust prompt detection
                if password_sent and not cmds_sent:
                   # Check for common prompts or just successful login indicators
                   decoded = buff.decode('utf-8', errors='ignore')
                   if "#" in decoded or "$" in decoded or "root@" in decoded or "Welcome" in decoded:
                        time.sleep(2) # Wait a bit for shell to be fully ready
                        os.write(fd, CMDS.encode())
                        cmds_sent = True
                        
            except OSError:
                break
    os.waitpid(pid, 0)
