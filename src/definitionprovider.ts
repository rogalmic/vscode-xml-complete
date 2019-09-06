import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray } from './types';
import XmlSimpleParser from './helpers/xmlsimpleparser';

export default class XmlDefinitionProvider implements vscode.DefinitionProvider {

	constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideDefinition(textDocument: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): Promise<vscode.Location> {
		let documentContent = textDocument.getText();
		let offset = textDocument.offsetAt(position);
		let scope = await XmlSimpleParser.getScopeForPosition(documentContent, offset);
		let wordRange = textDocument.getWordRangeAtPosition(position);
		let word = textDocument.getText(wordRange);

		switch (scope.context) {
			case "element":
				let tags = this.schemaPropertiesArray
					.map(p => p.tagCollection.filter(t => t.tag.name === word))
					.reduce((prev, next) => prev.concat(next), []);
				if (tags.length > 0) {
					let uri = vscode.Uri.parse(`xml2xsd-definition-provider://${encodeURIComponent(tags[0].tag.definitionUri || '')}`);
					let position = new vscode.Position(tags[0].tag.definitionLine || 1, tags[0].tag.definitionColumn || 1);
					return {
						uri: uri,
						range: new vscode.Range(position, position)
					};
				}
			break;

			case "attribute":
					let atts = this.schemaPropertiesArray
						.map(p => p.tagCollection
							.map(t => t.attributes.filter(a => a.name === word))
							.reduce((prev, next) => prev.concat(next), []))
						.reduce((prev, next) => prev.concat(next), []);
					if (atts.length > 0) {
						let uri = vscode.Uri.parse(`xml2xsd-definition-provider://${encodeURIComponent(atts[0].definitionUri || '')}`);
						let position = new vscode.Position(atts[0].definitionLine || 1, atts[0].definitionColumn || 1);
						return {
							uri: uri,
							range: new vscode.Range(position, position)
						};
					}
				break;
		}

		throw "Unable to get definition.";
	}
}