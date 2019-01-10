import * as vscode from 'vscode';

export class XmlCompleteSettings {
	schemaMapping: { xmlns: string, xsdUri: string, strict: boolean }[];
}

export class CompletionString {

	constructor(public name: string, public comment?: string) {
	}
}

export class XmlTag {
	tag: CompletionString;
	base: string[];
	attributes: Array<CompletionString>;
	visible: boolean;
}

export class XmlTagCollection extends Array<XmlTag> {
	loadAttributes(tagName: string | undefined): CompletionString[] {
		let result: CompletionString[] = [];
		if (tagName !== undefined) {
			let currentTags = this.filter(e => e.tag.name === tagName);
			if (currentTags.length > 0) {
				result.push(...currentTags.map(e => e.attributes).reduce((prev, next) => prev.concat(next), []));
				currentTags.forEach(e => e.base.forEach(b => result.push(...this.loadAttributes(b))));
			}
		}
		return result;
	}
}

export class XmlSchemaProperties {
	schemaUri: vscode.Uri;
	xsdContent: string;
	tagCollection: XmlTagCollection;
}

export class XmlSchemaPropertiesArray extends Array<XmlSchemaProperties> {
	filterUris(uris: vscode.Uri[]): Array<XmlSchemaProperties> {
		return this.filter(e => uris
			.find(u => u.toString() === e.schemaUri.toString()) !== undefined);
	}
}

export class XmlDiagnosticData {
	line: number;
	column: number;
	message: string;
	severity: "error" | "warning" | "info" | "hint";
}

export class XmlScope {
	tagName: string | undefined;
	context: "element" | "attribute" | "text" | undefined;
	content: string;
}