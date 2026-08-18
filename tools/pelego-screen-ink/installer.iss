#define MyAppName "PELEGO Screen Ink"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "PELEGO"
#define MyAppExeName "PELEGO.ScreenInk.exe"

[Setup]
AppId={{1A03BFD1-46F8-4AA7-97DE-EB299E07D355}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\PELEGO Screen Ink
DefaultGroupName=PELEGO Screen Ink
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=installer-output
OutputBaseFilename=PELEGO-Screen-Ink-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}

[Files]
Source: "publish\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\PELEGO Screen Ink"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\PELEGO Screen Ink"; Filename: "{app}\{#MyAppExeName}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "PELEGO Screen Ink"; ValueData: """{app}\{#MyAppExeName}"""; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir PELEGO Screen Ink"; Flags: nowait postinstall skipifsilent
