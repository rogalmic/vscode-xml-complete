import * as vscode from 'vscode';
import { XmlSchemaProperties } from './types';

export default class XmlFormatProvider implements vscode.DocumentFormattingEditProvider {

	constructor(_context: vscode.ExtensionContext, _schemaPropertiesArray: Array<XmlSchemaProperties>) {
	}

	provideDocumentFormattingEdits(textDocument: vscode.TextDocument, options: vscode.FormattingOptions, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
		const format = require('xml-formatter');
		const indentationString = options.insertSpaces ? Array(options.tabSize).fill(" "): "\t";

		let documentRange = new vscode.Range(textDocument.positionAt(0), textDocument.lineAt(textDocument.lineCount - 1).range.end);

		const emptyLines = /^\s*[\r\n]/gm;
		let formattedText  : string = format(textDocument.getText().trim(), {indentation: indentationString}).replace(emptyLines,"");

		if (!formattedText) {
			return [];
		}

        return [vscode.TextEdit.replace(documentRange, formattedText)];
	}
}
