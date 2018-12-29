import { ReadStream } from 'fs';

export default class XsdLoader {

	public static loadSchemaContentsFromUri(schemaLocationUri: string): Promise<string> {
		return new Promise<string>(
			(resolve, reject) => {
				let resultContent = ``;
				const getUri = require('get-uri');

				getUri(schemaLocationUri, function (err: any, rs: ReadStream) {
					if (err) {
						reject(`Error getting XSD:\n${err.toString()}`);
						return;
					}

					rs.on('data', (buf: any) => {
						resultContent += buf.toString();
					});

					rs.on('end', () => {
						resolve(resultContent);
					});
				});
			});
	}
}
