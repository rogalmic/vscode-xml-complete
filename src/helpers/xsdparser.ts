import { XmlTagCollection, CompletionString, XmlSchemaProperties, XmlTag, XsdType, CsType } from '../types';
import XsdSettings from './settings';

interface IXsdStackEntry {
	tag: string,
	attrName: string;
	attrValue: string;
}

export interface IAttributes {
	[index: string]: string;
}

export default class XsdParser {

	static boolValues: CompletionString[] = [new CompletionString("true", CsType.AttributeValue),
	new CompletionString("false", CsType.AttributeValue)];

	public static getSchemaTagsAndAttributes(schemaProperties: XmlSchemaProperties, prefix: string = null, fromSchemaProperties: XmlSchemaProperties = null): void {
		const sax = /*require("sax");*/ (window as any).sax;
		const parser = sax.parser(true);

		if (!schemaProperties.tagCollection) {
			schemaProperties.tagCollection = new XmlTagCollection();
		}
		const result = schemaProperties.tagCollection;

		let xmlDepthPath: IXsdStackEntry[] = [];
		//let defaultQualified: boolean;

		function addPrefix(name: string): string {
			if (!prefix || !name || name.indexOf(":") > -1)
				return name;
			return prefix + ":" + name;
		}

		function getNamedStack(): IXsdStackEntry[] {
			return xmlDepthPath.slice()
				.reverse()
				.filter(e => e.attrName);
		}

		parser.onopentag = (tagData: { name: string, isSelfClosing: boolean, attributes: IAttributes }) => {
			const xsAttrName = addPrefix(tagData.attributes["name"]);
			const xsAttrRef = tagData.attributes["ref"];

			xmlDepthPath.push({
				tag: tagData.name,
				attrName: xsAttrName,
				attrValue: tagData.attributes["value"]
			});

			if (tagData.name.endsWith(":schema")) {
				if (fromSchemaProperties)
					return;
				Object.keys(tagData.attributes).forEach((k) => {
					if (k.startsWith("xmlns:")) {
						result.setNsMap(k.substring("xmlns:".length), tagData.attributes[k]);
					}
				});
				//defaultQualified = tagData.attributes["elementFormDefault"] === "qualified";
			}
			else if (tagData.name.endsWith(":element") && xsAttrName) {
				const xsAttrType = tagData.attributes["type"];
				const elm = XmlTag.createElement(xsAttrName, xsAttrType ? [addPrefix(xsAttrType)] : []);
				result.push(elm);
				//formQualified: tagData.attributes["form"] === "qualified" || (defaultQualified && !tagData.attributes["form"]),

				// Elements under element
				const currentResultTag = xmlDepthPath.slice(0, xmlDepthPath.length - 1)
					.reverse()
					.filter(e => e.attrName)[0];

				if (currentResultTag) {
					result.filter(e => e.tag.name === addPrefix(currentResultTag.attrName))
						.forEach(e => e.childElements.push(elm));
				}
			}
			else if ((tagData.name.endsWith(":group") || tagData.name.endsWith(":element")) && xsAttrRef) {
				result.filter(e => e.tag.name === addPrefix(getNamedStack()[0].attrName))
					.forEach(e => e.baseElements.push(addPrefix(xsAttrRef)));
			}
			else if ((tagData.name.endsWith(":complexType") || tagData.name.endsWith(":group")) && xsAttrName) {
				result.push(XmlTag.createElementRef(xsAttrName));
			}
			else if (tagData.name.endsWith(":attributeGroup") && xsAttrName) {
				result.push(XmlTag.createAttributeGroup(xsAttrName));
			}
			else if (tagData.name.endsWith(":attribute") && xsAttrName) {
				const xsAttrType = tagData.attributes["type"];
				result.filter(e => e.tag.name === getNamedStack()[1].attrName)
					.forEach(e => e.attributes.push(new CompletionString(xsAttrName, CsType.Attribute, null,
						xsAttrType && xsAttrType.endsWith(":boolean") ? XsdParser.boolValues : null)));
			}
			else if (tagData.name.endsWith(":extension") && tagData.attributes["base"]) {
				result.filter(e => e.tag.name === getNamedStack()[0].attrName)
					.forEach(e => e.baseAttributes.push(addPrefix(tagData.attributes["base"])));
			}
			else if (tagData.name.endsWith(":attributeGroup") && xsAttrRef) {
				result.filter(e => e.tag.name === getNamedStack()[0].attrName)
					.forEach(e => e.baseAttributes.push(addPrefix(xsAttrRef)));
			}
			else if (tagData.name.endsWith(":import") && tagData.attributes["namespace"]) {
				const importSchemaProperties = XsdSettings.schemaPropertiesArray.filter(sp => sp.namespace === tagData.attributes["namespace"])[0];

				if (!importSchemaProperties) {
					console.log("import setting not found: " + tagData.attributes["namespace"]);
					return;
				}
				if (prefix) {
					//console.log("only first import level supported");
					return;
				}
				const importPrefix = result.prefixMap.get(importSchemaProperties.namespace);
				if (!importPrefix) {
					console.log("import ns not found: " + tagData.attributes["namespace"]);
					return;
				}
				//console.log("IMPORTING " + importPrefix + ": " + importSchemaProperties.namespace);
				XsdParser.getSchemaTagsAndAttributes(schemaProperties, importPrefix, importSchemaProperties);
			}
		};

		parser.onclosetag = (name: string) => {
			let popped = xmlDepthPath.pop();
			if (popped && popped.tag !== name) {
				console.warn("XSD open/close tag consistency error.");
			}
		};

		parser.ontext = (t: string) => {
			if (/\S/.test(t)) {
				let stack = xmlDepthPath.slice().reverse();

				if (!stack.find(e => e.tag.endsWith(":documentation"))) {
					return;
				}
				let currentCommentTarget = stack.filter(e => e.attrName)[0];
				if (!currentCommentTarget) {
					return;
				}
				if (currentCommentTarget.tag.endsWith(":element")) {
					result
						.filter(e => e.xsdType === XsdType.Element && e.tag.name === currentCommentTarget.attrName)
						.forEach(e => e.tag.comment = t.trim());
				}
				else if (currentCommentTarget.tag.endsWith(":complexType")) {
					result
						.filter(e => e.xsdType === XsdType.ElementRef && e.tag.name === currentCommentTarget.attrName)
						.forEach(e => e.tag.comment = t.trim());
					result
						.filter(e => e.
							baseElements.findIndex(t => t === currentCommentTarget.attrName) > -1)
						.forEach(e => e.tag.comment = t.trim());
				}
				else if (currentCommentTarget.tag.endsWith(":attribute")) {
					const attribs = result.filter(t => t.tag.name === getNamedStack()[1].attrName)
						.map(e => e.attributes)
						.reduce((prev, next) => prev.concat(next), [])
						.filter(e => currentCommentTarget && e.name === currentCommentTarget.attrName);

					const currentEnum = stack.filter(e => e.tag.endsWith(":enumeration"))[0];
					if (currentEnum) {
						attribs.forEach(e => {
							if (!e.documentation) {
								e.comment += ". Has value restrictions! See scrollable list below:"
								e.documentation = <monaco.IMarkdownString>{ value: "" }
								e.values = [];
							}
							e.documentation.value += `\n- **${currentEnum.attrValue}** : ${t.replace(/\s+\n*/g, " ")}`;
							e.values.push(new CompletionString(currentEnum.attrValue, CsType.AttributeValue, t.trim()));
						});
						return;
					}

					attribs.forEach(e => e.comment = t.trim());
				}
			}
		};

		parser.onend = () => {
			if (xmlDepthPath.length !== 0) {
				console.warn("XSD open/close tag consistency error (end).");
			}
		};

		parser.write((fromSchemaProperties || schemaProperties).xsdContent).close();
	}
}