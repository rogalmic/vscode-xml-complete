import * as vscode from 'vscode';

export class XmlCompleteSettings {
	schemaMapping: { xmlns: string, xsdUri: string, strict: boolean }[];
}

export class XmlTag {
	tag: string;
	base: string | undefined;
	attributes: Array<string>;
}

export class XmlTagCollection extends Array<XmlTag> {
	loadAttributes(tagName: string | undefined): string[] {
		let result: string[] = [];
		if (tagName !== undefined) {
			var currentTags = this.filter(e => e.tag === tagName);
			if (currentTags.length > 0) {
				result.push(...currentTags.map(e => e.attributes).reduce((prev, next) => prev.concat(next)));
				currentTags.forEach(e => result.push(...this.loadAttributes(e.base)));
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

export class XmlDiagnosticData {
	line: number;
	column: number;
	message: string;
	severity: "error" | "warning" | "info" | "hint";
}

export class XmlScope {
	tagName: string | undefined;
	context: "element" | "attribute" | "text" | undefined;
}