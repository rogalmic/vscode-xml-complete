import { normalize, join } from 'path';

export default class XsdParser {

	private static readonly saxPath = normalize(join(__dirname, '..', '..', 'lib/sax'));

	public static getSchemaTagsAndAttributes(xsdContent: string): Promise<{ tag: string, attributes: Array<string> }[]> {
		const sax = require(XsdParser.saxPath), strict = true, parser = sax.parser(strict);
		return new Promise<{ tag: string, attributes: Array<string> }[]>(
			(resolve) => {
				let result: { tag: string, attributes: Array<string> }[] = [];
				let xmlDepthPath: { tag: string, resultTagName: string }[] = [];

				parser.onopentag = (tagData: { name: string, isSelfClosing: boolean, attributes: Map<string, string> }) => {

					xmlDepthPath.push({ tag: tagData.name, resultTagName: tagData.attributes["name"] });

					if (tagData.name.endsWith(":element") && tagData.attributes["name"] !== undefined) {
						result.push({ tag: tagData.attributes["name"], attributes: [] });
					}

					if (tagData.name.endsWith(":complexType") && tagData.attributes["name"] !== undefined) {
						result.push({ tag: tagData.attributes["name"], attributes: [] });
					}

					if (tagData.name.endsWith(":attribute") && tagData.attributes["name"] !== undefined) {
						let currentResultTag = xmlDepthPath.slice().reverse().filter(e => e.resultTagName !== undefined)[1];
						result
							.filter(e => e.tag === currentResultTag.resultTagName)
							.forEach(e => e.attributes.push(tagData.attributes["name"]));
					}

					if (tagData.name.endsWith(":extension") && tagData.attributes["base"] !== undefined) {
						let baseArgs = result.slice().filter(e => e.tag === tagData.attributes["base"]).map(e => e.attributes).reduce((prev, next) => prev.concat(next));
						let currentResultTag = xmlDepthPath.slice().reverse().filter(e => e.resultTagName !== undefined)[0];

						result
							.filter(e => e.tag === currentResultTag.resultTagName)
							.forEach(e => e.attributes.push(...baseArgs));
					}
				};

				parser.onclosetag = (name: string) => {
					let popped = xmlDepthPath.pop();
					if (popped !== undefined && popped.tag !== name) {
						throw new Error("XSD open/close tag consistency error.");
					}
				};

				parser.onend = () => {
					if (xmlDepthPath.length !== 0) {
						throw new Error("XSD open/close tag consistency error (end).");
					}
					resolve(result);
				};

				parser.write(xsdContent).close();
			});
	}
}