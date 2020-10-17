import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray, CompletionString } from './types';
import { globalSettings } from './extension';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlHoverProvider implements vscode.HoverProvider {

	constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideHover(textDocument: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover> {
		const documentContent = textDocument.getText();
		const offset = textDocument.offsetAt(position);
		const xsdFileUris = (await XmlSimpleParser.getSchemaXsdUris(documentContent, textDocument.uri.toString(true),  globalSettings.schemaMapping))
			.map(u => vscode.Uri.parse(u));

		const nsMap = await XmlSimpleParser.getNamespaceMapping(documentContent);

		const scope = await XmlSimpleParser.getScopeForPosition(documentContent, offset);
		// https://github.com/microsoft/vscode/commits/master/src/vs/editor/common/model/wordHelper.ts
		const wordRange = textDocument.getWordRangeAtPosition(position, /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\<\>\/\?\s]+)/g);
		const word  = textDocument.getText(wordRange);

		let resultTexts: CompletionString[];

		if (token.isCancellationRequested) {
			resultTexts = [];

		} else if (scope.context === "text") {
			resultTexts = [];

		} else if (scope.tagName === undefined) {
			resultTexts = [];

		} else if (scope.context === "element") {
			resultTexts = this.schemaPropertiesArray
				.filterUris(xsdFileUris)
				.map(sp => sp.tagCollection.filter(e => e.visible).map(e => sp.tagCollection.fixNs(e.tag, nsMap)))
				.reduce((prev, next) => prev.concat(next), [])
				.sort()
				.filter(e => e.name === word)
				.filter((v, i, a) => a.findIndex(e => e.name === v.name && e.comment === v.comment ) === i);

		} else if (scope.context !== undefined) {
			resultTexts = this.schemaPropertiesArray
				.filterUris(xsdFileUris)
				.map(sp => sp.tagCollection.loadAttributesEx(scope.tagName, nsMap).map(s => sp.tagCollection.fixNs(s, nsMap)))
				.reduce((prev, next) => prev.concat(next), [])
				.sort()
				.filter(e => e.name === word)
				.filter((v, i, a) => a.findIndex(e => e.name === v.name && e.comment === v.comment ) === i);

		} else {
			resultTexts = [];
		}

		return {
			contents: resultTexts.map(t => new vscode.MarkdownString(t.comment)),
			range: wordRange
		  };
	}
}