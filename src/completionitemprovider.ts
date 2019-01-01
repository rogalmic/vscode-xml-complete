import * as vscode from 'vscode';
import { XmlSchemaProperties } from './types';
import { globalSettings } from './extension';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlCompletionItemProvider implements vscode.CompletionItemProvider {

	private schemaPropertiesArray: Array<XmlSchemaProperties>;

	constructor(_context: vscode.ExtensionContext, schemaPropertiesArray: Array<XmlSchemaProperties>) {
		this.schemaPropertiesArray = schemaPropertiesArray;
	}

	async provideCompletionItems(textDocument: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken, _context: vscode.CompletionContext): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
		let documentContent = textDocument.getText();
		let offset = textDocument.offsetAt(position);
		let xsdFileUris = (await XmlSimpleParser.getSchemaXsdUris(documentContent, globalSettings.schemaMapping)).map(u => vscode.Uri.parse(u));

		let scope = await XmlSimpleParser.getScopeForPosition(documentContent, offset);

		let resultTexts: string[] = [];

		if (scope.context === "element") {
			// TODO: if (scope.tagName.contains("."))
			resultTexts = this.schemaPropertiesArray
				.filter(e => xsdFileUris.find(u => u.toString() === e.schemaUri.toString()) !== undefined)
				.map(sp => sp.tagCollection.map(e => e.tag))
				.reduce((prev, next) => prev.concat(next))
				.sort()
				.filter((item, pos, ary) => !pos || item !== ary[pos - 1])
				.filter(t => t.indexOf(".") < 0);
		} else if (scope.context === "attribute") {
			resultTexts = this.schemaPropertiesArray
				.filter(e => xsdFileUris.find(u => u.toString() === e.schemaUri.toString()) !== undefined)
				.map(sp => sp.tagCollection.loadAttributes(scope.tagName))
				.reduce((prev, next) => prev.concat(next))
				.sort()
				.filter((item, pos, ary) => !pos || item !== ary[pos - 1]);
		} else if (scope.context === "text") {
			resultTexts = this.schemaPropertiesArray
				.filter(e => xsdFileUris.find(u => u.toString() === e.schemaUri.toString()) !== undefined)
				.map(sp => sp.tagCollection.map(e => `<${e.tag} />`)) //TODO: make proper selection selfclosing
				.reduce((prev, next) => prev.concat(next))
				.sort()
				.filter((item, pos, ary) => !pos || item !== ary[pos - 1]);

			resultTexts.push(...["<!--  -->", "<![CDATA[  ]]>", "<?  ?>", "<%  %>"]);
		} else {

			resultTexts = [];
		}

		return resultTexts
			.map(t => new vscode.CompletionItem(t, vscode.CompletionItemKind.Snippet));
	}
}