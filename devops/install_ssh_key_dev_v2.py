import pty
import os
import time
import sys
import select

HOST = "65.109.205.239"
PASS = "M4XjHXnrg4Xm"
PUB_KEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJR/bHh8v4FkPzqr+LGP7RQaH/ZtA3UjKb6K1Z8I2u3Z mahdifarimani@Mac.home"

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
