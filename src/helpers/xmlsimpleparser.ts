import { normalize, join } from 'path';
import { XmlTagCollection } from '../extension';

export default class XmlSimpleParser {

	private static readonly saxPath = normalize(join(__dirname, '..', '..', 'lib/sax'));

	public static getXmlDiagnosticData(xmlContent: string, xsdTags: XmlTagCollection): Promise<{ line: number, column: number, message: string, severity: "error" | "warning" | "info" }[]> {
		const sax = require(XmlSimpleParser.saxPath), strict = true, parser = sax.parser(strict);
		return new Promise<{ line: number, column: number, message: string, severity: "error" | "warning" | "info" }[]>(
			(resolve) => {
				let result: { line: number, column: number, message: string, severity: "error" | "warning" | "info" }[] = [];

				parser.onerror = () => {
					if (undefined === result.find(e => e.line === parser.line)) {
						result.push({ line: parser.line, column: parser.column, message: parser.error.message, severity: "error" });
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
								result.push({ line: parser.line, column: parser.column, message: `Unknown xml attribute '${a}' for tag '${tagData.name}'`, severity: "info" });
							}
						});
					}
					else if (tagData.name.indexOf(":") < 0) {
						result.push({ line: parser.line, column: parser.column, message: `Unknown xml tag '${tagData.name}'`, severity: "info" });
					}
				};

				parser.onend = () => {
					resolve(result);
				};

				parser.write(xmlContent).close();
			});
	}

	public static getSchemaXsdUris(xmlContent: string, schemaMapping: { xmlns: string, xsdUri: string }[]): Promise<string[]> {
		const sax = require(XmlSimpleParser.saxPath), strict = true, parser = sax.parser(strict);
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

	public static getScopeForPosition(xmlContent: string, line: number, column: number): Promise<{ tagName: string | undefined, context: "element" | "attribute" | undefined }> {
		const sax = require(XmlSimpleParser.saxPath), strict = true, parser = sax.parser(strict);
		return new Promise<{ tagName: string | undefined, context: "element" | "attribute" | undefined }>(
			(resolve) => {
				let result: { tagName: string | undefined, context: "element" | "attribute" | undefined } = { tagName: undefined, context: undefined };
				let done: boolean = false;
				let updatePosition = (positionContext: "element" | "attribute") => {
					if (parser.line >= line && parser.column >= column && !done) {
						result = { tagName: parser.tagName, context: positionContext };
						done = true;
					}
				};

				parser.onerror = () => {
					parser.resume();
				};

				parser.onopentagstart = () => {
					updatePosition("element");
				};

				parser.onattribute = () => {
					updatePosition("attribute");
				};

				parser.onopentag = () => {
					updatePosition("element");
				};

				parser.onclosetagstart = () => {
					updatePosition("element");
				};

				parser.onclosetag = () => {
					updatePosition("element");
				};

				parser.onend = () => {
					resolve(result);
				};

				parser.write(xmlContent).close();
			});
	}
}