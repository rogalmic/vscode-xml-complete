import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray, CompletionString, XmlTagCollection } from './types';
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

		const tagCollections = this.schemaPropertiesArray
				.filterUris(xsdFileUris)
				.map(sp => sp.tagCollection);

		if (token.isCancellationRequested) {
			resultTexts = [];

		} else if (scope.context === "text") {
			resultTexts = [];

		} else if (scope.tagName === undefined) {
			resultTexts = [];

		} else if (scope.context === "element") {
			resultTexts = tagCollections
				.flatMap(tc => tc.filter(e => e.visible).map(e => tc.fixNs(e.tag, nsMap)))
				.filter(e => e.name === word);

		} else if (scope.context !== undefined) {
			resultTexts = tagCollections
				.flatMap(tc => XmlTagCollection.loadAttributesEx(scope.tagName, nsMap, tagCollections).map(s => tc.fixNs(s, nsMap)))
				.filter(e => e.name === word);

		} else {
			resultTexts = [];
		}

		resultTexts = resultTexts
			.filter((v, i, a) => a.findIndex(e => e.name === v.name && e.comment === v.comment ) === i)
			.sort();

		return {
			contents: resultTexts.map(t => new vscode.MarkdownString(t.comment)),
			range: wordRange
		  };
	}
}