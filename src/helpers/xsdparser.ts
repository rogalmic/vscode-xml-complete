import { XmlTagCollection, CompletionString } from '../types';

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
							tag: new CompletionString(tagData.attributes["name"]),
							base: [tagData.attributes["type"]],
							attributes: [],
							visible: true
						});
					}

					if (tagData.name.endsWith(":complexType") && tagData.attributes["name"] !== undefined) {
						result.push({
							tag: new CompletionString(tagData.attributes["name"]),
							base: [],
							attributes: [],
							visible: false
						});
					}

					if (tagData.name.endsWith(":attributeGroup") && tagData.attributes["name"] !== undefined) {
						result.push({
							tag: new CompletionString(tagData.attributes["name"]),
							base: [],
							attributes: [],
							visible: false
						});
					}

					if (tagData.name.endsWith(":attribute") && tagData.attributes["name"] !== undefined) {
						let currentResultTag = xmlDepthPath
							.slice()
							.reverse()
							.filter(e => e.resultTagName !== undefined)[1];
						result
							.filter(e => e.tag.name === currentResultTag.resultTagName)
							.forEach(e => e.attributes.push(new CompletionString(tagData.attributes["name"])));
					}

					if (tagData.name.endsWith(":extension") && tagData.attributes["base"] !== undefined) {
						let currentResultTag = xmlDepthPath
							.slice()
							.reverse()
							.filter(e => e.resultTagName !== undefined)[0];

						result
							.filter(e => e.tag.name === currentResultTag.resultTagName)
							.forEach(e => e.base.push(tagData.attributes["base"]));
					}

					if (tagData.name.endsWith(":attributeGroup") && tagData.attributes["ref"] !== undefined) {
						let currentResultTag = xmlDepthPath
							.slice()
							.reverse()
							.filter(e => e.resultTagName !== undefined)[0];

						result
							.filter(e => e.tag.name === currentResultTag.resultTagName)
							.forEach(e => e.base.push(tagData.attributes["ref"]));
					}

					if (tagData.name.endsWith(":import") && tagData.attributes["schemaLocation"] !== undefined) {
						// TODO: handle this somehow, possibly separate methood to be called:
						// importFiles.push(tagData.attributes["schemaLocation"]);
					}
				};

				parser.onclosetag = (name: string) => {
					let popped = xmlDepthPath.pop();
					if (popped !== undefined && popped.tag !== name) {
						console.warn("XSD open/close tag consistency error.");
					}
				};

				parser.ontext = (t: string) => {
					if (/\S/.test(t)) {
						let stack = xmlDepthPath
							.slice()
							.reverse();

						if (!stack.find(e => e.tag.endsWith(":documentation"))) {
							return;
						}

						let currentCommentTarget =
							stack
								.filter(e => e.resultTagName !== undefined)[0];

						if (!currentCommentTarget) {
							return;
						}

						if (currentCommentTarget.tag.endsWith(":element")) {
							result
								.filter(e => currentCommentTarget && e.tag.name === currentCommentTarget.resultTagName)
								.forEach(e => e.tag.comment = t.trim());
						}
						else if (currentCommentTarget.tag.endsWith(":attribute")) {
							result
								.map(e => e.attributes)
								.reduce((prev, next) => prev.concat(next), [])
								.filter(e => currentCommentTarget && e.name === currentCommentTarget.resultTagName)
								.forEach(e => e.comment = t.trim());
						}
					}
				};

				parser.onend = () => {
					if (xmlDepthPath.length !== 0) {
						console.warn("XSD open/close tag consistency error (end).");
					}

					resolve(result);
				};

				parser.write(xsdContent).close();
			});
	}
}