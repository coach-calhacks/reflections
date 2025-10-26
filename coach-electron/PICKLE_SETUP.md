# Pickle Video Call Setup

## Overview
This guide explains how to set up Pickle (lip-sync tool) with BlackHole virtual audio routing to enable video calls with AI-generated talking heads in the Coach app.

## Prerequisites
- macOS (required for BlackHole)
- Pickle application installed and running
- Coach app with ElevenLabs integration

## Step 1: Install BlackHole Virtual Audio Driver

### Option A: Using Homebrew (Recommended)
```bash
brew install blackhole-2ch
```

### Option B: Manual Installation
1. Visit [BlackHole GitHub](https://github.com/ExistentialAudio/BlackHole)
2. Download the latest release
3. Install the `.pkg` file
4. Restart your Mac

## Step 2: Configure Audio Routing

### Create Multi-Output Device
1. Open **Audio MIDI Setup** (Applications > Utilities > Audio MIDI Setup)
2. Click the **+** button and select **Create Multi-Output Device**
3. Name it "Coach Audio" or similar
4. Check both:
   - Your default output device (e.g., "MacBook Pro Speakers")
   - BlackHole 2ch
5. Set this Multi-Output Device as your **System Output**

### Verify Audio Routing
1. Play any audio (YouTube, Spotify, etc.)
2. You should hear audio through your speakers AND see activity in BlackHole
3. Open **System Preferences > Sound > Input** and verify BlackHole 2ch is available

## Step 3: Configure Pickle

### Set Audio Input
1. Launch Pickle application
2. Go to **Settings** or **Audio Settings**
3. Set **Microphone Input** to "BlackHole 2ch"
4. Test by speaking - you should see audio levels in Pickle

### Position Pickle Window
1. Resize Pickle window to your preferred size
2. Position it where you want it captured
3. **Important**: Don't minimize the window (capture will be blank)

## Step 4: Test the Setup

### In Coach App
1. Launch the Coach app
2. Go to the Dashboard
3. Look for the "Video Call" section
4. Click "Start Video Call"
5. Select the Pickle window from the dropdown
6. Click the green "Accept" button in the popup
7. Start an ElevenLabs conversation

### Expected Behavior
- ElevenLabs audio plays through your speakers
- Audio also routes to BlackHole → Pickle
- Pickle lip-syncs to the audio
- Coach app captures Pickle's window and displays it in the popup
- You see a synchronized talking head in the FaceTime-style popup

## Troubleshooting

### No Audio in Pickle
- Check that BlackHole is set as Pickle's input
- Verify Multi-Output Device includes BlackHole
- Restart Pickle after changing audio settings

### Pickle Window Not Found
- Make sure Pickle is running and visible (not minimized)
- Try refreshing the window list in Coach app
- Check that Pickle window has a title (some apps hide window titles)

### Audio Out of Sync
- This is normal - slight delay is acceptable
- Pickle processes audio in real-time
- ElevenLabs audio plays immediately, Pickle follows shortly after

### Poor Video Quality
- Ensure Pickle window is not minimized
- Try resizing Pickle window for better capture
- Check that Pickle is generating video (not just audio)

### BlackHole Not Working
- Restart your Mac after installing BlackHole
- Check Audio MIDI Setup shows BlackHole 2ch
- Verify Multi-Output Device is set as System Output
- Try uninstalling and reinstalling BlackHole

## Advanced Configuration

### Custom Audio Routing
If you need more control over audio routing:
1. Use **Loopback** (paid) for more advanced routing
2. Use **SoundSource** for per-app audio routing
3. Use **Audio Hijack** for complex audio workflows

### Multiple Pickle Instances
- Each Pickle window will appear in the dropdown
- Choose the one you want to capture
- You can have multiple video calls with different Pickle instances

## Performance Notes

- Window capture uses ~5-10% CPU
- BlackHole adds minimal audio latency
- Pickle processing depends on your hardware
- For best performance, close unnecessary applications

## Security & Privacy

- BlackHole is open source and trusted
- Audio routing is local (no external services)
- Pickle window capture requires Screen Recording permission
- All processing happens on your local machine

## Uninstalling

### Remove BlackHole
```bash
# If installed via Homebrew
brew uninstall blackhole-2ch

# Manual removal
sudo rm -rf /Library/Audio/Plug-Ins/HAL/BlackHole.driver
```

### Reset Audio Settings
1. Open Audio MIDI Setup
2. Delete the Multi-Output Device
3. Set your original output as System Output
4. Restart your Mac

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all steps were completed correctly
3. Try restarting all applications
4. Check macOS permissions in System Preferences > Security & Privacy
