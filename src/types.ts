import * as vscode from 'vscode';

export class XmlCompleteSettings {
	schemaMapping: { xmlns: string, xsdUri: string, strict: boolean }[];
	formattingStyle: "singleLineAttributes" | "multiLineAttributes" | "fileSizeOptimized";
}

export class CompletionString {

	constructor(public name: string, public comment?: string, public definitionUri?:string, public definitionLine?:number, public definitionColumn?:number) {
	}
}

export class XmlTag {
	tag: CompletionString;
	base: string[];
	attributes: Array<CompletionString>;
	visible: boolean;
}

export class XmlTagCollection extends Array<XmlTag> {
	private nsMap: Map<string, string> = new Map<string, string>();

	setNsMap(xsdNsTag:string, xsdNsStr:string) {
		this.nsMap.set(xsdNsTag, xsdNsStr);
	}

	loadAttributesEx(tagName: string | undefined, localXmlMapping: Map<string, string>): CompletionString[] {
		let result: CompletionString[] = [];
		if (tagName !== undefined) {
			let fixedNames = this.fixNsReverse(tagName, localXmlMapping);
			fixedNames.forEach(fixn => {
				result.push(...this.loadAttributes(fixn));
			});
		}

		return result;
	}

	loadTagEx(tagName: string | undefined, localXmlMapping: Map<string, string>): CompletionString | undefined {
		let result = undefined;
		if (tagName !== undefined) {
			let fixedNames = this.fixNsReverse(tagName, localXmlMapping);
			let element =this.find(e => fixedNames.includes(e.tag.name))
			if (element !== undefined) {
				return element.tag;
			}
		}

		return result;
	}

	loadAttributes(tagName: string | undefined): CompletionString[] {
		let result: CompletionString[] = [];
		if (tagName !== undefined) {
			let currentTags = this.filter(e => e.tag.name === tagName || e.tag.name === tagName.substring(tagName.indexOf(":")+1));
			if (currentTags.length > 0) {
				result.push(...currentTags.map(e => e.attributes).reduce((prev, next) => prev.concat(next), []));
				currentTags.forEach(e =>
					e.base.filter(b => !currentTags.map(t=>t.tag.name).includes(b))
						.forEach(b => result.push(...this.loadAttributes(b))));
			}
		}
		return result;
	}

	fixNs(xsdString: CompletionString, localXmlMapping: Map<string, string>): CompletionString {
		let arr = xsdString.name.split(":");
		if (arr.length === 2 && this.nsMap.has(arr[0]) && localXmlMapping.has(this.nsMap[arr[0]]))
		{
			return new CompletionString (localXmlMapping[this.nsMap[arr[0]]] + ":" + arr[1], xsdString.comment, xsdString.definitionUri, xsdString.definitionLine, xsdString.definitionColumn);
		}
		return xsdString;
	}

	fixNsReverse(xmlString: string, localXmlMapping: Map<string, string>): Array<string> {
		let arr = xmlString.split(":");
		let xmlStrings = new Array<string>();

		localXmlMapping.forEach((v, k) => {
			if (v === arr[0]) {
				this.nsMap.forEach((v2, k2) => {
					if (v2 == k) {
						xmlStrings.push(k2 + ":" + arr[1]);
					}
				});
			}
		});
		xmlStrings.push(arr[arr.length-1]);

		return xmlStrings;
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
}