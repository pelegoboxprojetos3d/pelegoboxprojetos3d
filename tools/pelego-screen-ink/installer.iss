#define MyAppName "PELEGO Marcador de Tela"
#define MyAppVersion "2.9.0"
#define MyAppPublisher "PELEGO"
#define MyAppExeName "PELEGO.ScreenInk.exe"

[Setup]
; AppId e pasta permanecem iguais à V2.8 para instalar por cima sem criar outro aplicativo.
AppId={{1A03BFD1-46F8-4AA7-97DE-EB299E07D355}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\PELEGO Marcador de Tela
DefaultGroupName=PELEGO Marcador de Tela
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=installer-output
OutputBaseFilename=PELEGO-Marcador-de-Tela-Setup-V2.9
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
CloseApplications=force
RestartApplications=no
UsePreviousAppDir=yes

[Files]
Source: "publish\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\PELEGO Marcador de Tela"; Filename: "{app}\{#MyAppExeName}"
Name: "{autoprograms}\Desinstalar PELEGO Marcador de Tela"; Filename: "{uninstallexe}"
Name: "{autodesktop}\PELEGO Marcador de Tela"; Filename: "{app}\{#MyAppExeName}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "PELEGO Marcador de Tela"; ValueData: """{app}\{#MyAppExeName}"" /startup"; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir PELEGO Marcador de Tela"; Flags: nowait postinstall skipifsilent
