import * as vscode from 'vscode';
import { IXmlSchemaProperties } from './extension';

export default class XmlRangeFormatProvider implements vscode.DocumentRangeFormattingEditProvider {

	constructor(_context: vscode.ExtensionContext, _schemaPropertiesArray: Array<IXmlSchemaProperties>) {
	}

	provideDocumentRangeFormattingEdits(textDocument: vscode.TextDocument, _range: vscode.Range, _options: vscode.FormattingOptions, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
		const format = require('xml-formatter');
		let formattedText = format(textDocument.getText());
		console.log(formattedText);
        return [];
	}
}