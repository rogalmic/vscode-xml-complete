import { XmlTagCollection, XmlDiagnosticData, XmlScope } from '../types';

export default class XmlSimpleParser {

	public static getXmlDiagnosticData(xmlContent: string, xsdTags: XmlTagCollection, strict: boolean = true): Promise<XmlDiagnosticData[]> {
		const sax = require("sax");
		const parser = sax.parser(true);

		return new Promise<XmlDiagnosticData[]>(
			(resolve) => {
				let result: XmlDiagnosticData[] = [];

				parser.onerror = () => {
					if (undefined === result.find(e => e.line === parser.line)) {
						result.push({
							line: parser.line,
							column: parser.column,
							message: parser.error.message,
							severity: strict ? "error" : "warning"
						});
					}
					parser.resume();
				};

				parser.onopentag = (tagData: { name: string, isSelfClosing: boolean, attributes: Map<string, string> }) => {

					let nodeNameSplitted: Array<string> = tagData.name.split('.');

					if (xsdTags.find(e => e.tag.name === nodeNameSplitted[0])) {
						let schemaTagAttributes = xsdTags.loadAttributes(nodeNameSplitted[0]);
						nodeNameSplitted.shift();
						Object.keys(tagData.attributes).concat(nodeNameSplitted).forEach((a: string) => {
							if (schemaTagAttributes.findIndex(sta => sta.name === a) < 0 && a.indexOf(":") < 0 && a !== "xmlns") {
								result.push({
									line: parser.line,
									column: parser.column,
									message: `Unknown xml attribute '${a}' for tag '${tagData.name}'`, severity: "info"
								});
							}
						});
					}
					else if (tagData.name.indexOf(":") < 0) {
						result.push({
							line: parser.line,
							column: parser.column,
							message: `Unknown xml tag '${tagData.name}'`,
							severity: strict ? "info" : "hint"
						});
					}
				};

				parser.onend = () => {
					resolve(result);
				};

				parser.write(xmlContent).close();
			});
	}

	public static getSchemaXsdUris(xmlContent: string, schemaMapping: { xmlns: string, xsdUri: string }[]): Promise<string[]> {
		const sax = require("sax");
		const parser = sax.parser(true);

		return new Promise<string[]>(
			(resolve) => {
				let result: string[] = [];

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
							.reduce((prev, next) => prev.concat(next));
						result.push(...newUriStrings);
					}
				};

				parser.onend = () => {
					resolve(result.filter((v, i, a) => a.indexOf(v) === i));
				};

				parser.write(xmlContent).close();
			});
	}

	public static getScopeForPosition(xmlContent: string, offset: number): Promise<XmlScope> {
		const sax = require("sax");
		const parser = sax.parser(true);

		return new Promise<XmlScope>(
			(resolve) => {
				let result: XmlScope;
				let previousStartTagPosition = 0;
				let updatePosition = () => {

					if ((parser.position >= offset) && !result) {

						result = { tagName: parser.tagName, context: undefined };
						let content = xmlContent.substring(previousStartTagPosition, offset);

						if (content.lastIndexOf(">") >= content.lastIndexOf("<")) {
							result.context = "text";
						} else {
							let lastTagText = content.substring(content.lastIndexOf("<"));
							if (!/\s/.test(lastTagText)) {
								result.context = "element";
							} else if ((lastTagText.split(`"`).length & 1) !== 0) {
								result.context = "attribute";
							}
						}
					}

					previousStartTagPosition = parser.startTagPosition - 1;
				};

				parser.onerror = () => {
					parser.resume();
				};

				parser.ontext = (_t: any) => {
					updatePosition();
				};

				parser.onopentagstart = () => {
					updatePosition();
				};

				parser.onattribute = () => {
					updatePosition();
				};

				parser.onclosetag = () => {
					updatePosition();
				};

				parser.onend = () => {
					if (result === undefined) {
						result = { tagName: undefined, context: undefined };
					}
					resolve(result);
				};

				parser.write(xmlContent).close();
			});
	}

	public static checkXml(xmlContent: string): Promise<boolean> {
		const sax = require("sax");
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

	public static formatXml(xmlContent: string, indentationString: string, eol: string): Promise<string> {
		const sax = require("sax");
		const parser = sax.parser(true);

		let result: string[] = [];
		let xmlDepthPath: { tag: string, selfClosing: boolean, isTextContent: boolean }[] = [];

		let getIndentation = (): string => eol + Array(xmlDepthPath.length).fill(indentationString).join("");

		return new Promise<string>(
			(resolve) => {

				parser.onerror = () => {
					parser.resume();
				};

				parser.ontext = (t) => {
					result.push(/^\s*$/.test(t) ? `` : `${t}`);
				};

				parser.ondoctype = (t) => {
					result.push(`${eol}<!DOCTYPE${t}>`);
				};

				parser.onprocessinginstruction = (instruction: { name: string, body: string }) => {
					result.push(`${eol}<?${instruction.name} ${instruction.body}?>`);
				};

				parser.onsgmldeclaration = (t) => {
					result.push(`${eol}<!${t}>`);
				};

				parser.onopentag = (tagData: { name: string, isSelfClosing: boolean, attributes: Map<string, string> }) => {
					let argString: string[] = [];
					for (let arg in tagData.attributes) {
						argString.push(` ${arg}="${tagData.attributes[arg]}"`);
					}

					if (xmlDepthPath.length > 0) {
						xmlDepthPath[xmlDepthPath.length - 1].isTextContent = false;
					}

					result.push(`${getIndentation()}<${tagData.name}${argString.join("")}${tagData.isSelfClosing ? "/>" : ">"}`);

					xmlDepthPath.push({
						tag: tagData.name,
						selfClosing: tagData.isSelfClosing,
						isTextContent: true
					});
				};

				parser.onclosetag = (t) => {
					let tag = xmlDepthPath.pop();

					if (tag && !tag.selfClosing) {
						result.push(tag.isTextContent ? `</${t}>` : `${getIndentation()}</${t}>`);
					}
				};

				parser.oncomment = (t) => {
					result.push(`<!--${t}-->`);
				};

				parser.onopencdata = () => {
					result.push(`${eol}<![CDATA[`);
				};

				parser.oncdata = (t) => {
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