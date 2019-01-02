import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray } from './types';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlRangeFormatProvider implements vscode.DocumentRangeFormattingEditProvider {

	constructor(_context: vscode.ExtensionContext, _schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideDocumentRangeFormattingEdits(textDocument: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, _token: vscode.CancellationToken): Promise<vscode.TextEdit[]> {
		const indentationString = options.insertSpaces ? Array(options.tabSize).fill(' ').join("") : "\t";

		let before = textDocument.getText(new vscode.Range(textDocument.positionAt(0), range.start)).trim();

		let selection = textDocument.getText(new vscode.Range(range.start, range.end)).trim();

		let after = textDocument.getText(new vscode.Range(range.end, textDocument.lineAt(textDocument.lineCount - 1).range.end)).trim();

		const selectionSeparator = "<!--352cf605-57c7-48a8-a5eb-2da215536443-->";
		let text = [before, selection, after].join(selectionSeparator);

		if (!await XmlSimpleParser.checkXml(text)) {
			return [];
		}

		let formattedText: string = (await XmlSimpleParser.formatXml(text, indentationString))
			.split(selectionSeparator)[1]
			.trim();

		if (!formattedText) {
			return [];
		}

		return [vscode.TextEdit.replace(range, formattedText)];
	}
}