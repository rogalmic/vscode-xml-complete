import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray } from './types';
import { globalSettings } from './extension';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlRangeFormatProvider implements vscode.DocumentRangeFormattingEditProvider {

	constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideDocumentRangeFormattingEdits(textDocument: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, _token: vscode.CancellationToken): Promise<vscode.TextEdit[]> {
		const indentationString = options.insertSpaces ? Array(options.tabSize).fill(' ').join("") : "\t";

		const before = textDocument.getText(new vscode.Range(textDocument.positionAt(0), range.start)).trim();

		const selection = textDocument.getText(new vscode.Range(range.start, range.end)).trim();

		const after = textDocument.getText(new vscode.Range(range.end, textDocument.lineAt(textDocument.lineCount - 1).range.end)).trim();

		const selectionSeparator = "<!--352cf605-57c7-48a8-a5eb-2da215536443-->";
		const text = [before, selection, after].join(selectionSeparator);

		if (!await XmlSimpleParser.checkXml(text)) {
			return [];
		}

		const emptyLines = /^\s*[\r?\n]|\s*[\r?\n]$/g;

		let formattedText: string =
			(await XmlSimpleParser.formatXml(text, indentationString, textDocument.eol === vscode.EndOfLine.CRLF ? `\r\n` : `\n`, globalSettings.formattingStyle))
				.split(selectionSeparator)[1]
				.replace(emptyLines, "");

		if (!formattedText) {
			return [];
		}

		return [vscode.TextEdit.replace(range, formattedText)];
	}
}