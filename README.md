# Xml Complete

This extension helps with editing XML files with schema location set. It does not require any runtime like `java`, `python` or `xmllint`.

## Features

Plans:
- no platform dependencies ever [**done**]
- no excessive configuration in VSCode [**done**]
- XSD reading from XML schemaLocation attribute [**ongoing**]
- basic and realtime linter (XML + optional XSD) [**ongoing**]
- fast autocomplete based on XSD [**ongoing**]
- formatting XML [**planned**]

## Samples

### Local schema file
```xml
<root
...
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="file:///C:/Users/rogalmic/Documents/src/Avalonia/src/Markup/Avalonia.xsd"
/>
```
### Remote schema file
```xml
<root
...
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="https://raw.githubusercontent.com/rogalmic/vscode-xml-complete/master/test/Avalonia/AvaloniaXamlSchema.xsd"
/>
```

### Supported URI protocols

| Protocol  | Description                     | Example
|:---------:|:-------------------------------:|:---------------------------------:
| `data`    | XSD encoded directly in link    | `data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D`
| `file`    | XSD from local storage          | `file:///c:/windows/example.ini`
| `ftp`     | XSD from ftp server             | `ftp://ftp.kernel.org/pub/site/README`
| `http`    | XSD from http server            | `http://www.example.com/path/to/name`
| `https`   | XSD from https server           | `https://www.example.com/path/to/name`


## Requirements

*If you have any requirements or dependencies, add a section describing those and how to install and configure them.*

## Known Issues

*Calling out known issues can help limit users opening duplicate issues against your extension.*

