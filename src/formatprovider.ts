import * as vscode from 'vscode';
import { IXmlSchemaProperties } from './extension';

export default class XmlFormatProvider implements vscode.DocumentFormattingEditProvider {
	private schemaPropertiesArray: Array<IXmlSchemaProperties>;

	constructor(_context: vscode.ExtensionContext, schemaPropertiesArray: Array<IXmlSchemaProperties>) {
		this.schemaPropertiesArray = schemaPropertiesArray;
	}

	provideDocumentFormattingEdits(textDocument: vscode.TextDocument, _options: vscode.FormattingOptions, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
		const format = require('xml-formatter');
		let formattedText = format(textDocument.getText());
		console.log(formattedText);
        return [];
	}
}
