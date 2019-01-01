import { XmlTagCollection } from '../types';

export default class XsdParser {

	public static getSchemaTagsAndAttributes(xsdContent: string): Promise<XmlTagCollection> {
		const sax = require("sax");
		const parser = sax.parser(true);

		return new Promise<XmlTagCollection>(
			(resolve) => {
				let result: XmlTagCollection = new XmlTagCollection();
				let xmlDepthPath: { tag: string, resultTagName: string }[] = [];

				parser.onopentag = (tagData: { name: string, isSelfClosing: boolean, attributes: Map<string, string> }) => {

					xmlDepthPath.push({
						tag: tagData.name,
						resultTagName: tagData.attributes["name"]
					});

					if (tagData.name.endsWith(":element") && tagData.attributes["name"] !== undefined) {
						result.push({
							tag: tagData.attributes["name"],
							base: tagData.attributes["type"],
							attributes: []
						});
					}

					if (tagData.name.endsWith(":complexType") && tagData.attributes["name"] !== undefined) {
						result.push({
							tag: tagData.attributes["name"],
							base: undefined,
							attributes: []
						});
					}

					if (tagData.name.endsWith(":attribute") && tagData.attributes["name"] !== undefined) {
						let currentResultTag = xmlDepthPath
							.slice()
							.reverse()
							.filter(e => e.resultTagName !== undefined)[1];
						result
							.filter(e => e.tag === currentResultTag.resultTagName)
							.forEach(e => e.attributes.push(tagData.attributes["name"]));
					}

					if (tagData.name.endsWith(":extension") && tagData.attributes["base"] !== undefined) {
						let currentResultTag = xmlDepthPath
							.slice()
							.reverse()
							.filter(e => e.resultTagName !== undefined)[0];

						result
							.filter(e => e.tag === currentResultTag.resultTagName)
							.forEach(e => e.base = tagData.attributes["base"]);
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