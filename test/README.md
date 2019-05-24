# Usage samples for `Xml Complete`

In essence: different ways of referencing XSD file, to achieve parsing and tag/attribute completion.

1. Avalonia

   - `AvaloniaXamlSchema.xsd` generated from binaries, via .NET reflection.
   - schema referenced in `MainWindow.xaml` : `xsi:schemaLocation="https://raw.githubusercontent.com/rogalmic/vscode-xml-complete/master/test/Avalonia/AvaloniaXamlSchema.xsd"`

1. BigFile

   - around 1 MB XML file
   - schema referenced in `BigFile.xml` : `xsi:schemaLocation="https://raw.githubusercontent.com/rogalmic/vscode-xml-complete/master/test/BigFile/BigFile.xsd"`

1. CustomersOrders

   - schema referenced in `CustomersOrders.xml` : `xsi:schemaLocation="https://raw.githubusercontent.com/rogalmic/vscode-xml-complete/master/test/CustomersOrders/CustomersOrders.xsd"`

1. MsBuild (csproj)

   - using default configuration for namespace `http://schemas.microsoft.com/developer/msbuild/2003`
   - schema referenced in `MsBuild.csproj` : `xmlns="http://schemas.microsoft.com/developer/msbuild/2003"`

1. Simple

   - schema referenced in `Simple.xml` : `xsi:schemaLocation="https://raw.githubusercontent.com/rogalmic/vscode-xml-complete/master/test/Simple/Simple.xsd"`

1. Svg

   - multiple XSD files, whitespace separated
   - schema referenced in `Test.svg` : `xsi:schemaLocation="https://raw.githubusercontent.com/dumistoklus/svg-xsd-schema/master/svg.xsd https://raw.githubusercontent.com/dumistoklus/svg-xsd-schema/master/xlink.xsd https://raw.githubusercontent.com/dumistoklus/svg-xsd-schema/master/namespace.xsd"`

1. Wpf

   - `Wpf.xsd` generated from binaries, via .NET reflection.
   - using default configuration for namespace `http://schemas.microsoft.com/winfx/2006/xaml/presentation`
   - schema referenced in `MainWindow.xaml` : `xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"`

1. EmbeddedXsd

   - schema embedded in `EmbeddedXsd.xml` : `xsi:schemaLocation="data:text/plain;base64,PHhzOnN.......aGVtYT4="`