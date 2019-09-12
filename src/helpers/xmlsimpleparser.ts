import { XmlDiagnosticData, XmlScope, XmlSchemaProperties, XmlTag } from '../types';
import XsdSettings from './settings';
import { IAttributes } from './xsdparser';

export interface INsMap {
	uriToNs: Map<string, string>,
	nsToUri: Map<string, string>
}

export default class XmlSimpleParser {

	public static getXmlDiagnosticData(xmlContent: string, schemaProperties: XmlSchemaProperties[], nsMap: INsMap): XmlDiagnosticData[] {
		const sax = /*require("sax");*/ (window as any).sax;
		const parser = sax.parser(true);

		let result: XmlDiagnosticData[] = [];
		const tagStack: string[] = [];
		let stackIndex = -1, startLine = 0, startColumn = 0;
		const attribsRange: Map<string, monaco.IRange> = new Map<string, monaco.IRange>();

		parser.onerror = () => {
			if (!result.find(e => e.range.startLineNumber === parser.line)) {
				result.push(<XmlDiagnosticData>{
					range: new monaco.Range(parser.line, parser.column, parser.line, parser.column),
					message: parser.error.message,
					severity: "error"
				} as XmlDiagnosticData);
			}
			parser.resume();
		};

		parser.onattribute = (tag: { name: string, value: string }) => {
			attribsRange.set(tag.name, {
				startLineNumber: parser.line,
				startColumn: parser.column - tag.name.length - tag.value.length - 2,
				endLineNumber: parser.line,
				endColumn: parser.column + 1
			});
		};

		parser.onopentagstart = (tag: { name: string }) => {
			tagStack[++stackIndex] = tag.name;
			attribsRange.clear();
			startLine = parser.line;
			startColumn = parser.column;
		};

		parser.onclosetag = () => {
			stackIndex--;
		};

		if (schemaProperties) {
			parser.onopentag = (tagData: { name: string, isSelfClosing: boolean, attributes: IAttributes }) => {
				let parentTagName = stackIndex == 0 ? null : tagStack[stackIndex - 1];
				parentTagName = parentTagName ? parentTagName.substring(parentTagName.indexOf(":") + 1) : null;

				const parentTag = schemaProperties
					.map(sp => ({
						tag: sp.tagCollection.filter(e => e.visible && e.tag.name === parentTagName)[0],
						foundInSp: sp
					}))
					.filter(t => t.tag)
					.reduce((prev, next) => prev.concat(next), [])[0];

				const strict = parentTag && XsdSettings.schemaMapping.find(m => m.xsdUri === parentTag.foundInSp.schemaUri.toString() && m.strict === true) ? true : false;

				const allowedTags = schemaProperties
					.map(sp => sp.tagCollection.loadTagEx(parentTag ? parentTag.tag.name : null, nsMap)
						.map(tag => sp.tagCollection.fixNs(tag, nsMap, sp)))
					.reduce((prev, next) => prev.concat(next), [])
					.filter(t => t.name == tagData.name);

				if (allowedTags.length) {
					const findTagName = tagData.name.substring(tagData.name.indexOf(":") + 1);

					let ft: XmlTag, foundInSp: XmlSchemaProperties;
					const xsdTags = schemaProperties.filter(sp => {
						let _ft = sp.tagCollection.filter(t => t.tag.name === findTagName)[0]
						if (_ft) {
							ft = _ft;
							foundInSp = sp;
							return true;
						}
						return false;
					});

					let schemaTagAttributes = xsdTags[0].tagCollection.loadAttributesEx(ft.tag.name, nsMap, null);

					Object.keys(tagData.attributes).forEach((a: string) => {
						const attrib = schemaTagAttributes.find(sta => sta.name === a);
						if (!attrib && a.indexOf(":!") < 0
							&& !a.startsWith("xmlns") && !a.startsWith("data-")) {
							const pos = attribsRange.get(a);
							result.push(<XmlDiagnosticData>{
								range: pos,
								message: `Unknown xml attribute '${a}' for tag '${tagData.name}'`,
								severity: strict ? "info" : "hint"
							});
						}
						else if (attrib && attrib.values && attrib.values.findIndex(a => a.name === tagData.attributes[attrib.name]) < 0) {
							const pos = attribsRange.get(a);
							result.push(<XmlDiagnosticData>{
								range: new monaco.Range(pos.startLineNumber, pos.startColumn + a.length + 1, pos.endLineNumber, pos.endColumn),
								message: `Unknown xml attribute value '${a}' for attribute '${attrib.name}' in tag '${tagData.name}'`,
								severity: strict ? "info" : "hint"
							});
						}
					});
				}
				else if (tagData.name.indexOf(":!") < 0) {
					result.push(<XmlDiagnosticData>{
						range: new monaco.Range(startLine, startColumn - tagData.name.length - 1, parser.line, parser.column + 1),
						message: `Unknown xml tag '${tagData.name}'`,
						severity: strict ? "info" : "hint"
					});
				}
			};
		}

		parser.write(xmlContent).close();
		return result;
	}

	public static getSchemaXsdUris(xmlContent: string, schemaMapping: { xmlns: string, xsdUri: string }[]): string[] {
		const sax = /*require("sax");*/ (window as any).sax;
		const parser = sax.parser(true);

		const result: string[] = [];

		parser.onerror = () => {
			parser.resume();
		};

		parser.onattribute = (attr: any) => {
			if (attr.name.endsWith(":schemaLocation")) {
				result.push(...attr.value.split(/\s+/));
			} else if (attr.name === "xmlns") {
				let newUriStrings = schemaMapping
					.filter(m => m.xmlns === attr.value)
					.map(m => m.xsdUri.split(/\s+/))
					.reduce((prev, next) => prev.concat(next), []);
				result.push(...newUriStrings);
			} else if (attr.name.startsWith("xmlns:")) {
				let newUriStrings = schemaMapping
					.filter(m => m.xmlns === attr.value)
					.map(m => m.xsdUri.split(/\s+/))
					.reduce((prev, next) => prev.concat(next), []);
				result.push(...newUriStrings);
			}
		};

		parser.write(xmlContent).close();

		return result.filter((v, i, a) => a.indexOf(v) === i);
	}

	public static getNamespaceMapping(xmlContent: string): INsMap {
		const sax = /*require("sax");*/ (window as any).sax;
		const parser = sax.parser(true);

		const uriToNs = new Map<string, string>();
		const nsToUri = new Map<string, string>();

		parser.onerror = () => {
			parser.resume();
		};

		parser.onattribute = (attr: any) => {
			if (attr.name === "xmlns") {
				uriToNs.set(attr.value, "");
				nsToUri.set("", attr.value);
			}
			else if (attr.name.startsWith("xmlns:")) {
				const ns = attr.name.substring("xmlns:".length);
				uriToNs.set(attr.value, ns);
				nsToUri.set(ns, attr.value);
			}
		};

		parser.write(xmlContent).close();
		return { uriToNs: uriToNs, nsToUri: nsToUri };
	}

	public static getScopeForPosition(xmlContent: string, offset: number): XmlScope {
		const sax = /*require("sax");*/ (window as any).sax;
		const parser = sax.parser(true);

		const tagStack: string[] = [];
		let stackIndex = -1;

		let result: XmlScope;
		let previousStartTagPosition = 0;
		let updatePosition = () => {
			if ((parser.position >= offset) && !result) {
				let content = xmlContent.substring(previousStartTagPosition, offset);
				content = content.lastIndexOf("<") >= 0 ? content.substring(content.lastIndexOf("<")) : content;

				let normalizedContent = content.concat(" ").replace("/", "").replace("\t", " ").replace("\n", " ").replace("\r", " ");
				let tagName = content.substring(1, normalizedContent.indexOf(" "));

				result = {
					tagName: /^[\<a-zA-Z0-9_:\.\-]*$/.test(tagName) ? tagName : undefined,
					parentTagName: tagStack[stackIndex]
				};

				if (content.lastIndexOf(">") >= content.lastIndexOf("<")) {
					result.context = "text";
				} else {
					let lastTagText = content.substring(content.lastIndexOf("<"));
					if (!/\s/.test(lastTagText)) {
						result.context = "element";
					} else if ((lastTagText.split(`"`).length % 2) !== 0) {
						result.context = "attribute";
					}
				}
			}
			previousStartTagPosition = parser.startTagPosition - 1;
		};

		parser.onerror = () => {
			parser.resume();
		};

		parser.ontext = () => {
			updatePosition();
		};

		parser.onopentagstart = (tag: { name: string }) => {
			tagStack[++stackIndex] = tag.name;
			updatePosition();
		};

		parser.onattribute = () => {
			updatePosition();
		};

		parser.onclosetag = () => {
			stackIndex--;
			updatePosition();
		};

		parser.onend = () => {
			if (result === undefined) {
				result = { tagName: undefined, parentTagName: undefined, context: undefined };
			}

		};

		parser.write(xmlContent).close();
		return result;
	}

	public static checkXml(xmlContent: string): Promise<boolean> {
		const sax = /*require("sax");*/ (window as any).sax;
		const parser = sax.parser(true);

		let result: boolean = true;
		return new Promise<boolean>(
			(resolve) => {
				parser.onerror = () => {
					result = false;
					parser.resume();
				};

				parser.onend = () => {
					resolve(result);
				};

				parser.write(xmlContent).close();
			});
	}

	public static formatXml(xmlContent: string, indentationString: string, eol: string, formattingStyle: "singleLineAttributes" | "multiLineAttributes" | "fileSizeOptimized"): Promise<string> {
		const sax = /*require("sax");*/ (window as any).sax;
		const parser = sax.parser(true);

		let result: string[] = [];
		let xmlDepthPath: { tag: string, selfClosing: boolean, isTextContent: boolean }[] = [];

		let multiLineAttributes = formattingStyle === "multiLineAttributes";
		indentationString = (formattingStyle === "fileSizeOptimized") ? "" : indentationString;

		let getIndentation = (): string =>
			(!result[result.length - 1] || result[result.length - 1].indexOf("<") >= 0 || result[result.length - 1].indexOf(">") >= 0)
				? eol + Array(xmlDepthPath.length).fill(indentationString).join("")
				: "";

		return new Promise<string>(
			(resolve) => {

				parser.onerror = () => {
					parser.resume();
				};

				parser.ontext = (t: string) => {
					result.push(/^\s*$/.test(t) ? `` : `${t}`);
				};

				parser.ondoctype = (t: string) => {
					result.push(`${eol}<!DOCTYPE${t}>`);
				};

				parser.onprocessinginstruction = (instruction: { name: string, body: string }) => {
					result.push(`${eol}<?${instruction.name} ${instruction.body}?>`);
				};

				parser.onsgmldeclaration = (t: string) => {
					result.push(`${eol}<!${t}>`);
				};

				parser.onopentag = (tagData: { name: string, isSelfClosing: boolean, attributes: IAttributes }) => {
					let argString: string[] = [""];
					for (let arg in tagData.attributes) {
						argString.push(` ${arg}="${tagData.attributes[arg]}"`);
					}

					if (xmlDepthPath.length > 0) {
						xmlDepthPath[xmlDepthPath.length - 1].isTextContent = false;
					}

					let attributesStr = argString.join(multiLineAttributes ? `${getIndentation()}${indentationString}` : ``);
					result.push(`${getIndentation()}<${tagData.name}${attributesStr}${tagData.isSelfClosing ? "/>" : ">"}`);

					xmlDepthPath.push({
						tag: tagData.name,
						selfClosing: tagData.isSelfClosing,
						isTextContent: true
					});
				};

				parser.onclosetag = (t: string) => {
					let tag = xmlDepthPath.pop();

					if (tag && !tag.selfClosing) {
						result.push(tag.isTextContent ? `</${t}>` : `${getIndentation()}</${t}>`);
					}
				};

				parser.oncomment = (t: string) => {
					result.push(`<!--${t}-->`);
				};

				parser.onopencdata = () => {
					result.push(`${eol}<![CDATA[`);
				};

				parser.oncdata = (t: string) => {
					result.push(t);
				};

				parser.onclosecdata = () => {
					result.push(`]]>`);
				};

				parser.onend = () => {
					resolve(result.join(``));
				};
				parser.write(xmlContent).close();
			});
	}
}