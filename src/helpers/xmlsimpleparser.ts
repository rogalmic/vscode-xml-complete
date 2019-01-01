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

					if (xsdTags.find(e => e.tag === nodeNameSplitted[0])) {
						let schemaTagAttributes = xsdTags.loadAttributes(nodeNameSplitted[0]);
						nodeNameSplitted.shift();
						Object.keys(tagData.attributes).concat(nodeNameSplitted).forEach((a: string) => {
							if (schemaTagAttributes.indexOf(a) < 0 && a.indexOf(":") < 0 && a !== "xmlns") {
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
						result.push(attr.value);
					} else if (attr.name === "xmlns") {
						let newUriString = schemaMapping.filter(m => m.xmlns === attr.value).map(m => m.xsdUri).pop();
						if (newUriString !== undefined) {
							result.push(newUriString);
						}
					}
				};

				parser.onend = () => {
					resolve(result);
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
						console.log(`Autocomplete xml triggered for ${content} , current tag is '${parser.tagName}'`);

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

		let result : boolean = true;
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
}