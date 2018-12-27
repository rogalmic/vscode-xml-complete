import * as vscode from 'vscode';
import { IXmlSchemaProperties } from './extension';

export default class XmlRangeFormatProvider implements vscode.DocumentRangeFormattingEditProvider {

	private schemaPropertiesArray: Array<IXmlSchemaProperties>;

	constructor(_context: vscode.ExtensionContext, schemaPropertiesArray: Array<IXmlSchemaProperties>) {
		this.schemaPropertiesArray = schemaPropertiesArray;
	}

	provideDocumentRangeFormattingEdits(textDocument: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
		const format = require('xml-formatter');
		let formattedText = format(textDocument.getText());
		console.log(formattedText);
        return [];
	}
}