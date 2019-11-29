import * as vscode from 'vscode';
import { XmlSchemaPropertiesArray, CompletionString } from './types';
import XmlSimpleParser from './helpers/xmlsimpleparser';
import { schemaId } from './extension';

export default class XmlDefinitionProvider implements vscode.DefinitionProvider {

	constructor(protected extensionContext: vscode.ExtensionContext, protected schemaPropertiesArray: XmlSchemaPropertiesArray) {
	}

	async provideDefinition(textDocument: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): Promise<vscode.Location> {
		let documentContent = textDocument.getText();
		let offset = textDocument.offsetAt(position);
		let scope = await XmlSimpleParser.getScopeForPosition(documentContent, offset);
		// https://github.com/microsoft/vscode/commits/master/src/vs/editor/common/model/wordHelper.ts
		let wordRange = textDocument.getWordRangeAtPosition(position, /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\<\>\/\?\s]+)/g);
		let word = textDocument.getText(wordRange);

		let noDefinitionUri = (e: string) => `data:text/plain;base64,${Buffer.from(`No definition found for '${e}'`).toString('base64')}`;

		let generateResult = (cs: CompletionString) => new vscode.Location(
			vscode.Uri.parse(`${schemaId}://${Buffer.from(cs.definitionUri || noDefinitionUri(word)).toString('hex')}`),
			new vscode.Position(cs.definitionLine || 0, cs.definitionColumn || 0)
		);

		switch (scope.context) {
			case "element":
				let tags = this.schemaPropertiesArray
					.map(p => p.tagCollection.filter(t => t.tag.name === word))
					.reduce((prev, next) => prev.concat(next), []);

				if (tags.length > 0) {
					return generateResult(tags[0].tag);
				}
			break;

			case "attribute":
					let atts = this.schemaPropertiesArray
						.map(p => p.tagCollection
							.map(t => t.attributes.filter(a => a.name === word))
							.reduce((prev, next) => prev.concat(next), []))
						.reduce((prev, next) => prev.concat(next), []);

					if (atts.length > 0) {
						return generateResult(atts[0]);
					}
				break;
		}

		throw `Unable to get definition for phrase '${word}'.`;
	}
}