# Install Padel Punto on your watch

Padel Punto is not in the Zepp app store yet. Every version is on the
**[Releases page](https://github.com/fat-toni/PadelPunto/releases)**, and there are two ways to get it onto your watch:

| | You use | You need |
|---|---|---|
| **[A. Zepp app](#a-with-the-zepp-app)** | the official Zepp app on your phone | a computer (Windows, macOS or Linux) and a Zepp account |
| **[B. Gadgetbridge](#b-with-gadgetbridge)** | [Gadgetbridge](https://gadgetbridge.org) instead of the Zepp app | only your phone |

## A. With the Zepp app

You install the app from your computer with the [Zeus CLI](https://docs.zepp.com/docs/guides/tools/cli/), Zepp's developer tool.

**1. Install Node.js** (once)

| System  | Command |
|---------|---------|
| Windows | `winget install OpenJS.NodeJS.LTS` (then open a new terminal) |
| macOS   | `brew install node` ([Homebrew](https://brew.sh)) |
| Linux   | `sudo apt install nodejs npm` (Debian/Ubuntu) or your distro's package manager |

You can also download it from [nodejs.org](https://nodejs.org).

**2. Download Padel Punto**

On the [Releases page](https://github.com/fat-toni/PadelPunto/releases), open the newest version and download
**Source code (zip)** under *Assets*. Unzip it and open a terminal in the unzipped folder (`PadelPunto-…`).

<details>
<summary>Or with Git</summary>

```bash
git clone https://github.com/fat-toni/PadelPunto.git
cd PadelPunto
```

</details>

**3. Start the preview**

```bash
npm install -g @zeppos/zeus-cli
npm install
zeus preview
```

The first time, `zeus preview` opens your browser to log in with your Zepp account.
Then choose **Amazfit Bip 6** and a QR code appears.

On Windows, if PowerShell says that `zeus.ps1` cannot be loaded, run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use the Command Prompt (`cmd`) instead.
On Linux and macOS, if `npm install -g` fails with a permission error, see
[npm's guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally).

**4. Scan the QR code with your phone**

1. In the Zepp app, open **Profile → Settings → About** and tap the Zepp icon 7 times in a row until a pop-up appears. This turns on developer mode.
2. Open the new **Developer Mode** entry in the Zepp app and tap **Scan**.
3. Scan the QR code. Padel Punto is installed on your watch.

When you are done, run `zeus logout` and turn developer mode off again.

## B. With Gadgetbridge

[Gadgetbridge](https://gadgetbridge.org) is a free Android app that can replace the Zepp app and supports the Bip 6.
It installs Zepp OS apps straight from a file:

1. On the [Releases page](https://github.com/fat-toni/PadelPunto/releases), download **PadelPunto-<version>.zab** to your phone.
2. Open the file with Gadgetbridge (or share it to Gadgetbridge) and confirm the install.

> [!NOTE]
> This way has not been tried with Padel Punto yet. If it works for you (or not), please open an issue.

← [Back to the README](../README.md)
