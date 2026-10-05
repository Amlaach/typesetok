; Inno Setup Script for TypesetOK (TOK) Desktop Publishing System
; Bilingual Support: Hebrew (עברית) and English
; =========================================================================

#define MyAppName "TypesetOK"
; build-installer.mjs passes /DMyAppVersion=<package.json version>
#ifndef MyAppVersion
  #define MyAppVersion "0.7.5"
#endif
#define MyAppPublisher "TypesetOK Team"
#define MyAppURL "https://github.com/TypesetOK/typesetok"
#define MyAppExeName "TypesetOK.exe"
#define SourceDir "..\dist\TypesetOK-v" + MyAppVersion + "-windows-x64"

[Setup]
AppId={{E1B385C9-5D8A-4A73-98FB-364F36AA8C80}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
LicenseFile=..\LICENSE.md
OutputDir=..\dist
OutputBaseFilename=TypesetOK-v{#MyAppVersion}-Setup-x64
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
ChangesAssociations=yes

[Languages]
Name: "hebrew"; MessagesFile: "compiler:Languages\Hebrew.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
hebrew.LaunchProgram=הפעל את TypesetOK כעת
english.LaunchProgram=Launch TypesetOK now
hebrew.CreateDesktopIcon=צור קיצור דרך בשולחן העבודה
english.CreateDesktopIcon=Create a desktop shortcut
hebrew.AssociateTok=שייך קובצי מסמך (.tok) ל-TypesetOK
english.AssociateTok=Associate TypesetOK document files (.tok)
hebrew.AssociateTokBook=שייך קובצי ספר (.tokbook) ל-TypesetOK
english.AssociateTokBook=Associate TypesetOK book files (.tokbook)
hebrew.FileAssociations=שיוך סוגי קבצים
english.FileAssociations=File Associations
hebrew.AdditionalIcons=קיצורי דרך נוספים
english.AdditionalIcons=Additional shortcuts

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "associatetok"; Description: "{cm:AssociateTok}"; GroupDescription: "{cm:FileAssociations}"
Name: "associatetokbook"; Description: "{cm:AssociateTokBook}"; GroupDescription: "{cm:FileAssociations}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; NOTE: Don't use "Flags: ignoreversion" on any shared system files

[Registry]
; Associate .tok
Root: HKA; Subkey: "Software\Classes\.tok"; ValueType: string; ValueName: ""; ValueData: "TypesetOK.Document"; Flags: uninsdeletevalue; Tasks: associatetok
Root: HKA; Subkey: "Software\Classes\TypesetOK.Document"; ValueType: string; ValueName: ""; ValueData: "TypesetOK Document"; Flags: uninsdeletekey; Tasks: associatetok
Root: HKA; Subkey: "Software\Classes\TypesetOK.Document\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"; Tasks: associatetok
Root: HKA; Subkey: "Software\Classes\TypesetOK.Document\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: associatetok

; Associate .tokbook
Root: HKA; Subkey: "Software\Classes\.tokbook"; ValueType: string; ValueName: ""; ValueData: "TypesetOK.Book"; Flags: uninsdeletevalue; Tasks: associatetokbook
Root: HKA; Subkey: "Software\Classes\TypesetOK.Book"; ValueType: string; ValueName: ""; ValueData: "TypesetOK Multi-Document Book"; Flags: uninsdeletekey; Tasks: associatetokbook
Root: HKA; Subkey: "Software\Classes\TypesetOK.Book\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"; Tasks: associatetokbook
Root: HKA; Subkey: "Software\Classes\TypesetOK.Book\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: associatetokbook

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram}"; Flags: nowait postinstall skipifsilent
