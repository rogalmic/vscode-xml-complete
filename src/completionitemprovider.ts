import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray, CompletionString, XmlTagCollection } from './types';
import { globalSettings } from './extension';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlCompletionItemProvider implements vscode.CompletionItemProvider {

	constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideCompletionItems(textDocument: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, _context: vscode.CompletionContext): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
		const documentContent = textDocument.getText();
		const offset = textDocument.offsetAt(position);
		const xsdFileUris = (await XmlSimpleParser.getSchemaXsdUris(documentContent, textDocument.uri.toString(true), globalSettings.schemaMapping))
			.map(u => vscode.Uri.parse(u));

		const nsMap = await XmlSimpleParser.getNamespaceMapping(documentContent);

		const scope = await XmlSimpleParser.getScopeForPosition(documentContent, offset);

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

		} else if (scope.context === "element" && scope.tagName.indexOf(".") < 0) {
			resultTexts = tagCollections
				.flatMap(tc => tc.filter(e => e.visible).map(e => tc.fixNs(e.tag, nsMap)))
				.sort();

		} else if (scope.context !== undefined) {
			resultTexts = tagCollections
				.flatMap(tc =>
					XmlTagCollection.loadAttributesEx(scope.tagName?.replace(".", ""), nsMap, tagCollections)
					.map(s => tc.fixNs(s, nsMap)))
				.sort();

		} else {
			resultTexts = [];
		}

		resultTexts = resultTexts.filter((v, i, a) => a.findIndex(e => e.name === v.name && e.comment === v.comment ) === i)

		return resultTexts
			.map(t => {
				const ci = new vscode.CompletionItem(t.name, vscode.CompletionItemKind.Snippet);
				ci.detail = scope.context;
				ci.documentation = t.comment;
				return ci;
			});
	}
}