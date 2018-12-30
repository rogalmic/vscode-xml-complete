import * as vscode from 'vscode';
import { IXmlSchemaProperties } from './extension';

export default class XmlRangeFormatProvider implements vscode.DocumentRangeFormattingEditProvider {

	constructor(_context: vscode.ExtensionContext, _schemaPropertiesArray: Array<IXmlSchemaProperties>) {
	}

	provideDocumentRangeFormattingEdits(textDocument: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.TextEdit[]> {
		const format = require('xml-formatter');
		const indentationString = options.insertSpaces ? Array(options.tabSize).fill(' ').join("") : "\t";

		let before = textDocument.getText(new vscode.Range(textDocument.positionAt(0), range.start)).trim();

		let selection = textDocument.getText(new vscode.Range(range.start, range.end)).trim();

		let after = textDocument.getText(new vscode.Range(range.end, textDocument.lineAt(textDocument.lineCount - 1).range.end)).trim();

		const selectionSeparator = "<!--352cf605-57c7-48a8-a5eb-2da215536443-->";
		let text = [before, selection, after].join(selectionSeparator);

		const emptyLines = /^\s*[\r\n]/gm;
		let formattedText : string = format(text, {indentation: indentationString}).split(selectionSeparator)[1].replace(emptyLines,"");

		if (!formattedText) {
			return [];
		}

		return [vscode.TextEdit.replace(range, formattedText)];
	}
}