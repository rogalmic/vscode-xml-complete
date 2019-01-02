import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray } from './types';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlFormatProvider implements vscode.DocumentFormattingEditProvider {

	constructor(_context: vscode.ExtensionContext, _schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideDocumentFormattingEdits(textDocument: vscode.TextDocument, options: vscode.FormattingOptions, _token: vscode.CancellationToken): Promise<vscode.TextEdit[]> {
		const indentationString = options.insertSpaces ? Array(options.tabSize).fill(' ').join("") : "\t";

		let documentRange = new vscode.Range(textDocument.positionAt(0), textDocument.lineAt(textDocument.lineCount - 1).range.end);

		let formattedText: string = (await XmlSimpleParser.formatXml(textDocument.getText(), indentationString))
			.trim();

		if (!formattedText) {
			return [];
		}

		return [vscode.TextEdit.replace(documentRange, formattedText)];
	}
}
