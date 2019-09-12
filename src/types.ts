import { INsMap } from "./helpers/xmlsimpleparser";

//export class XmlCompleteSettings {
//	schemaMapping: { xmlns: string, xsdUri: string, strict: boolean }[];
//	formattingStyle: "singleLineAttributes" | "multiLineAttributes" | "fileSizeOptimized";
//}


export const enum CsType {
	Element = 1,
	Attribute = 2,
	AttributeValue = 3,
}

export class CompletionString {
	public documentation?: monaco.IMarkdownString;

	constructor(public name: string, public type: CsType, public comment?: string, public values?: CompletionString[]) {
	}

	public newWithName?(name: string): CompletionString {
		const clone = <CompletionString>Object.create(this);
		clone.name = name;
		return clone;
	}
}

export const enum XsdType {
	Unknown = 0,
	Element = 1,
	ElementRef = 2,
	AttributeGroup = 3,
}

export class XmlTag {

	private constructor(tag: string) {
		this.tag = new CompletionString(tag, CsType.Element);
	}

	static createElement(tag: string, baseElements: string[]): XmlTag {
		const x = new XmlTag(tag);
		x.baseElements = baseElements;
		x.visible = true;
		x.xsdType = XsdType.Element;
		return x;
	}

	static createElementRef(tag: string): XmlTag {
		const x = new XmlTag(tag);
		x.xsdType = XsdType.ElementRef;
		return x;
	}

	static createAttributeGroup(tag: string): XmlTag {
		const x = new XmlTag(tag);
		x.xsdType = XsdType.AttributeGroup;
		return x;
	}

	tag: CompletionString;
	baseAttributes?: string[] = [];
	attributes?: CompletionString[] = [];
	visible?: boolean = false;

	formQualified?: boolean;
	xsdType?: XsdType;
	baseElements?: string[] = [];
	childElements?: XmlTag[] = [];
}

export class XmlTagCollection extends Array<XmlTag> {
	private nsMap: Map<string, string>;
	prefixMap: Map<string, string>;

	constructor() {
		super();
		this.nsMap = new Map<string, string>();
		this.prefixMap = new Map<string, string>();
	}

	setNsMap(xsdNsTag: string, xsdNsStr: string) {
		this.nsMap.set(xsdNsTag, xsdNsStr);
		this.prefixMap.set(xsdNsStr, xsdNsTag);
	}

	loadAttributesEx(tagName: string, localNsMap: INsMap, namespace: string): CompletionString[] {
		let result: CompletionString[] = [];
		if (tagName) {
			let arr = tagName.split(":");
			if (arr.length === 2) {
				if (localNsMap.uriToNs.get(namespace) !== arr[0]) {
					return result;
				}
				this.loadAttributes(arr[1], result);
			}
			else {
				this.loadAttributes(tagName, result);
			}
		}
		return result;
	}

	loadAttributes(tagName: string, result: CompletionString[], recursiveCheck: string[] = [], recursiveCall: number = 0) {
		//console.log("--".repeat(recursiveCall) + " a: " + tagName);
		const currentTags = this.filter(e => e.tag.name === tagName);
		if (!currentTags.length)
			return;

		result.push(...currentTags.map(e => e.attributes).reduce((prev, next) => prev.concat(next), []));

		currentTags.forEach(e =>
			e.baseAttributes.filter(b => !currentTags.map(t => t.tag.name).includes(b) && !recursiveCheck.includes(b))
				.forEach(b => {
					recursiveCheck.push(b);
					this.loadAttributes(b, result, recursiveCheck, recursiveCall + 1);
				}));

		currentTags.filter(t => t.xsdType === XsdType.AttributeGroup || (recursiveCall === 0 && t.xsdType === XsdType.Element))
			.forEach(e =>
				e.baseElements.filter(b => !currentTags.map(t => t.tag.name).includes(b) && !recursiveCheck.includes(b))
					.forEach(b => {
						recursiveCheck.push(b);
						this.loadAttributes(b, result, recursiveCheck, recursiveCall + 1);
					}));
	}


	loadTagEx(tagName: string | undefined, localNsMap: INsMap): CompletionString[] {
		let result: CompletionString[] = [];
		if (tagName) {
			this.loadTags(tagName, result);
		}
		else {
			return this.filter(e => e.visible).map(e => e.tag);
		}
		return result;
	}

	loadTags(tagName: string, result: CompletionString[], recursiveCheck: string[] = [], recursiveCall: number = 0) {
		// NOTE: Does not support restriction/difference between same element name under different parents!! need complete'ish tree for that
		//console.log("--".repeat(recursiveCall) + " e: " + tagName);
		const currentTags = this.filter(e => e.tag.name === tagName);
		if (!currentTags.length)
			return;

		if (recursiveCall > 0)
			currentTags.filter(t => t.visible).forEach(t => result.push(t.tag));

		result.push(...currentTags.map(e => e.childElements.map(t => t.tag)).reduce((prev, next) => prev.concat(next), []));

		currentTags.filter(t => t.xsdType === XsdType.ElementRef || (recursiveCall === 0 && t.xsdType === XsdType.Element))
			.forEach(e =>
				e.baseElements.filter(b => b && !currentTags.map(t => t.tag.name).includes(b) && !recursiveCheck.includes(b))
					.forEach(b => {
						recursiveCheck.push(b);
						this.loadTags(b, result, recursiveCheck, recursiveCall + 1);
					}));
	}

	completeNsTagName(tagName: string, localNsMap: INsMap, nsUri: string, parentTagNs: string): string {
		let arr = tagName.split(":");
		if (arr.length === 2) {
			if (this.nsMap.has(arr[0]) && localNsMap.uriToNs.has(this.nsMap.get(arr[0]))) {
				const ns = localNsMap.uriToNs.get(this.nsMap.get(arr[0]));
				return ns === "" || parentTagNs === ns ? arr[1] : ns + ":" + arr[1];
			}
		}
		else if (arr.length === 1 && nsUri && localNsMap.uriToNs.has(nsUri)) {
			const ns = localNsMap.uriToNs.get(nsUri);
			return ns === "" || ns === parentTagNs ? tagName : ns + ":" + tagName;
		}
		return tagName;
	}

	fixNs(xsdString: CompletionString, localNsMap: INsMap, sp: XmlSchemaProperties, parentTagNs: string = null): CompletionString {
		const newName = this.completeNsTagName(xsdString.name, localNsMap, sp ? sp.namespace : null, parentTagNs);
		return xsdString.name === newName ? xsdString : xsdString.newWithName(newName);
	}

}

export class XmlSchemaProperties {
	schemaUri: monaco.Uri;
	xsdContent: string;
	tagCollection: XmlTagCollection;
	namespace: string;
}

export class XmlSchemaPropertiesArray extends Array<XmlSchemaProperties> {
	filterUris(uris: monaco.Uri[]): Array<XmlSchemaProperties> {
		return this.filter(e => uris
			.find(u => u.toString() === e.schemaUri.toString()) !== undefined);
	}
}

export class XmlDiagnosticData {
	range: monaco.Range;
	message: string;
	severity: "error" | "warning" | "info" | "hint";
}

export class XmlScope {
	tagName: string | undefined;
	parentTagName: string;
	context?: "element" | "attribute" | "text" | undefined;
}