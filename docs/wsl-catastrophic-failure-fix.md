# Fixing WSL Catastrophic Failure: `Wsl/Service/E_UNEXPECTED`

This error means the WSL service (`WslService`) failed to initialize. Below are the fixes, ordered from least disruptive to most disruptive.

---

## Quick Fixes (try these first)

### 1. Restart the WSL Service

Open **PowerShell as Administrator** and run:

```powershell
# Stop any running WSL instances
wsl --shutdown

# Restart the core service
net stop WslService
net start WslService

# Restart the HyperV service WSL depends on
net stop vmcompute
net start vmcompute

# Try launching WSL again
wsl
```

### 2. Restart the HNS (Host Network Service)

A corrupted virtual network adapter can cause this. In **Admin PowerShell**:

```powershell
net stop hns
net start hns
wsl --shutdown
wsl
```

### 3. Reboot Windows

Sometimes the simplest fix works. Do a full restart (not shutdown + power on, which may use Fast Startup and skip a clean re-init):

```powershell
shutdown /r /t 0
```

---

## Intermediate Fixes

### 4. Update WSL

An outdated WSL kernel is a frequent cause. In **Admin PowerShell**:

```powershell
wsl --update
wsl --shutdown
wsl
```

If that fails, force a reinstall of the WSL package:

```powershell
wsl --update --web-download
```

### 5. Re-register your distro

If WSL starts but your distro is broken:

```powershell
# List installed distros
wsl --list --verbose

# Unregister (WARNING: this removes the distro's filesystem)
# Only do this if you have backups or don't mind re-setting up
wsl --unregister Ubuntu

# Reinstall from the Microsoft Store or:
wsl --install -d Ubuntu
```

### 6. Check Windows Features

Make sure the required features are enabled. In **Admin PowerShell**:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

Then **reboot**.

### 7. Check for Conflicting Software

The following can interfere with WSL's Hyper-V/virtual networking:

- **VPN software** (Cisco AnyConnect, GlobalProtect, etc.) — try disconnecting
- **Antivirus** (Kaspersky, Bitdefender, etc.) — try temporarily disabling
- **Docker Desktop** — if running, close it and retry WSL
- **VMware / VirtualBox** — older versions conflict with Hyper-V

---

## Nuclear Options

### 8. Reset the WSL Platform Entirely

```powershell
# Uninstall WSL completely
wsl --uninstall

# Reboot
shutdown /r /t 0

# After reboot, reinstall
wsl --install
```

### 9. Repair Windows System Files

Corruption in Windows system files can break WSL. In **Admin Command Prompt**:

```cmd
sfc /scannow
DISM /Online /Cleanup-Image /RestoreHealth
```

Reboot after both complete.

### 10. Check Windows Event Viewer for Details

If none of the above work, get more diagnostic info:

1. Open **Event Viewer** (`eventvwr.msc`)
2. Navigate to **Applications and Services Logs > Microsoft > Windows > WSL**
3. Look for Error-level events around the time of the failure
4. The detailed error message will point to the specific subsystem that failed

---

## Prevention

- Keep WSL updated: `wsl --update` periodically
- Avoid `shutdown` with Fast Startup; prefer `restart` to ensure a clean service re-init
- Export distro backups: `wsl --export Ubuntu ubuntu-backup.tar`
