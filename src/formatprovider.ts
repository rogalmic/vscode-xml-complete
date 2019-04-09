import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray } from './types';
import { globalSettings } from './extension';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlFormatProvider implements vscode.DocumentFormattingEditProvider {

	constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideDocumentFormattingEdits(textDocument: vscode.TextDocument, options: vscode.FormattingOptions, _token: vscode.CancellationToken): Promise<vscode.TextEdit[]> {
		const indentationString = options.insertSpaces ? Array(options.tabSize).fill(' ').join("") : "\t";

		const documentRange = new vscode.Range(textDocument.positionAt(0), textDocument.lineAt(textDocument.lineCount - 1).range.end);
		const text = textDocument.getText();

		let formattedText: string =
			(await XmlSimpleParser.formatXml(text, indentationString, textDocument.eol === vscode.EndOfLine.CRLF ? `\r\n` : `\n`, globalSettings.formattingStyle))
				.trim();

		if (!formattedText) {
			return [];
		}

		return [vscode.TextEdit.replace(documentRange, formattedText)];
	}
}
