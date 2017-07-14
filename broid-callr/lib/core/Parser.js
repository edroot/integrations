"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const schemas_1 = require("@broid/schemas");
const utils_1 = require("@broid/utils");
const Promise = require("bluebird");
const uuid = require("uuid");
const R = require("ramda");
class Parser {
    constructor(serviceName, serviceID, logLevel) {
        this.serviceID = serviceID;
        this.generatorName = serviceName;
        this.logger = new utils_1.Logger('parser', logLevel);
    }
    validate(event) {
        this.logger.debug('Validation process', { event });
        const parsed = utils_1.cleanNulls(event);
        if (!parsed || R.isEmpty(parsed)) {
            return Promise.resolve(null);
        }
        if (!parsed.type) {
            this.logger.debug('Type not found.', { parsed });
            return Promise.resolve(null);
        }
        return schemas_1.default(parsed, 'activity')
            .then(() => parsed)
            .catch((err) => {
            this.logger.error(err);
            return null;
        });
    }
    parse(event) {
        this.logger.debug('Normalize process', { event });
        const normalized = utils_1.cleanNulls(event);
        if (!normalized || R.isEmpty(normalized)) {
            return Promise.resolve(null);
        }
        const activitystreams = this.createActivityStream(normalized);
        activitystreams.actor = {
            id: normalized.senderPhoneNumber,
            name: normalized.senderPhoneNumber,
            type: 'Person',
        };
        activitystreams.target = {
            id: normalized.toPhoneNumber,
            name: normalized.toPhoneNumber,
            type: 'Person',
        };
        return Promise.resolve(activitystreams)
            .then((as2) => {
            if (utils_1.isUrl(normalized.text)) {
                return utils_1.fileInfo(normalized.text, this.logger)
                    .then((infos) => {
                    const mediaType = infos.mimetype;
                    if (mediaType.startsWith('image/')) {
                        as2.object = {
                            id: normalized.eventID || this.createIdentifier(),
                            mediaType,
                            type: 'Image',
                            url: normalized.text,
                        };
                    }
                    else if (mediaType.startsWith('video/')) {
                        as2.object = {
                            id: normalized.eventID || this.createIdentifier(),
                            mediaType,
                            type: 'Video',
                            url: normalized.text,
                        };
                    }
                    return as2;
                });
            }
            return as2;
        })
            .then((as2) => {
            if (R.isEmpty(as2.object) && !R.isEmpty(as2.text)) {
                as2.object = {
                    content: normalized.text,
                    id: normalized.eventID || this.createIdentifier(),
                    type: 'Note',
                };
            }
            return as2;
        });
    }
    normalize(event) {
        this.logger.debug('Event received to normalize');
        const body = R.path(['request', 'body'], event);
        if (!body || R.isEmpty(body)) {
            return Promise.resolve(null);
        }
        const bodyType = body.type;
        if (bodyType !== 'sms.mo') {
            return Promise.resolve(null);
        }
        const senderPhoneNumber = R.path(['data', 'from'], body);
        const toPhoneNumber = R.path(['data', 'to'], body);
        const text = R.path(['data', 'text'], body);
        const eventID = R.path(['event_id'], body);
        const eventAt = R.path(['event_at'], body);
        const data = {
            eventID,
            senderPhoneNumber,
            text,
            timestamp: new Date(eventAt).getTime(),
            toPhoneNumber,
            type: bodyType,
        };
        return Promise.resolve(data);
    }
    createIdentifier() {
        return uuid.v4();
    }
    createActivityStream(normalized) {
        return {
            '@context': 'https://www.w3.org/ns/activitystreams',
            'actor': {},
            'generator': {
                id: this.serviceID,
                name: this.generatorName,
                type: 'Service',
            },
            'object': {},
            'published': normalized.timestamp || Math.floor(Date.now() / 1000),
            'target': {},
            'type': 'Create',
        };
    }
}
exports.Parser = Parser;
