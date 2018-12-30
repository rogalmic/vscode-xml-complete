import * as vscode from 'vscode';
import { IXmlSchemaProperties, globalSettings } from './extension';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlCompletionItemProvider implements vscode.CompletionItemProvider {

	private schemaPropertiesArray: Array<IXmlSchemaProperties>;

	constructor(_context: vscode.ExtensionContext, schemaPropertiesArray: Array<IXmlSchemaProperties>) {
		this.schemaPropertiesArray = schemaPropertiesArray;
	}

	async provideCompletionItems(textDocument: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken, _context: vscode.CompletionContext): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
		let documentContent = textDocument.getText();
		let xsdFileUris = (await XmlSimpleParser.getSchemaXsdUris(documentContent, globalSettings.schemaMapping)).map(u => vscode.Uri.parse(u));

		let context = await XmlSimpleParser.getScopeForPosition(documentContent, position.line, position.character);

		let resultTexts: string[];

		if (context === "element") {
			resultTexts = this.schemaPropertiesArray
				.filter(e => xsdFileUris.find( u => u.toString() === e.schemaUri.toString()) !== undefined)
				.map(sp => sp.tagCollection.map(e => e.tag))
				.reduce((prev, next) => prev.concat(next))
				.sort()
				.filter((item, pos, ary) => !pos || item !== ary[pos - 1])
				.filter(t => t.indexOf(".") < 0);
		} else if (context === "attribute") {
			resultTexts = this.schemaPropertiesArray
				.filter(e => xsdFileUris.find( u => u.toString() === e.schemaUri.toString()) !== undefined)
				.map(sp => sp.tagCollection.map(e => e.attributes).reduce((prev, next) => prev.concat(next)))
				.reduce((prev, next) => prev.concat(next))
				.sort()
				.filter((item, pos, ary) => !pos || item !== ary[pos - 1]);
		} else {
			resultTexts = [ "JACKPOT" ];
		}

		// let wordRange = textDocument.getWordRangeAtPosition(position, new RegExp(/^[a-zA-Z0-9]+$/));
		// let word = textDocument.getText(wordRange);		}
		return resultTexts
			.map(t => new vscode.CompletionItem(t, vscode.CompletionItemKind.Snippet));
	}
}