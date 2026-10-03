import pty
import os
import time
import sys

def check_ssh(name, host, password):
    print(f"--- CHECKING {name} ({host}) ---")
    pid, fd = pty.fork()
    if pid == 0:
        # Connect and run a simple command: hostname and remote uptime
        # Added StrictHostKeyChecking=no to avoid yes/no prompts
        os.execvp("ssh", ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", f"root@{host}", "echo 'SUCCESS: Connected to' $(hostname) ; docker --version || echo 'WARNING: Docker not found'"])
    else:
        output = b""
        password_sent = False
        start_time = time.time()
        
        while True:
            # Timeout safety
            if time.time() - start_time > 15:
                print("TIMEOUT: Connection took too long.")
                break
                
            try:
                chunk = os.read(fd, 1024)
                if not chunk:
                    break
                output += chunk
                
                # Check for password prompt
                if (b"password:" in chunk.lower() or b"passphrase" in chunk.lower()) and not password_sent:
                    os.write(fd, (password + "\n").encode())
                    password_sent = True
                    
            except OSError:
                break
        
        _, status = os.waitpid(pid, 0)
        decoded = output.decode('utf-8', errors='ignore')
        if "SUCCESS" in decoded:
            print("✅ CONNECTION ESTABLISHED")
            # Extract docker version if present
            for line in decoded.splitlines():
                if "Docker version" in line:
                    print(f"   {line.strip()}")
                if "WARNING" in line:
                    print(f"   {line.strip()}")
        elif "Permission denied" in decoded:
            print("❌ CONNECTION FAILED: Permission Denied (Wrong Password?)")
        else:
            print(f"❌ CONNECTION FAILED: Unknown Error \nOutput snippet: {decoded[:200]}...")

# Credentials
PROD_HOST = os.environ.get("PROD_HOST", "65.109.212.86")
PROD_PASS = os.environ.get("PROD_PASS")

DEV_HOST = os.environ.get("DEV_HOST", "65.109.205.239")
DEV_PASS = os.environ.get("DEV_PASS")

if not PROD_PASS and not DEV_PASS:
    import getpass
    print("Notice: PROD_PASS / DEV_PASS environment variables not set.")
    PROD_PASS = getpass.getpass(f"Enter root password for PRODUCTION ({PROD_HOST}): ")
    DEV_PASS = getpass.getpass(f"Enter root password for DEV ({DEV_HOST}): ")

if PROD_PASS:
    check_ssh("PRODUCTION", PROD_HOST, PROD_PASS)
    print("\n")

if DEV_PASS:
    check_ssh("DEV SERVER", DEV_HOST, DEV_PASS)
