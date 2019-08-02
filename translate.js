const translate = async (message, target) => {
    // Imports the Google Cloud client library
    const { Translate } = require('@google-cloud/translate');
    // Instantiates a client
    const translate = new Translate({ projectId: 'scriber-1564685823814' });
    // Translates input text
    return await translate.translate(message, target);
};

module.exports = translate;
