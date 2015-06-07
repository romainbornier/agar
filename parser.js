/**
 * parser
 *
 * Parser for agar.io messages.
 */
var Parser = require('binary-parser').Parser;

var MESSAGE_TYPES = {
  UPDATES: 16,
  SCREEN_POSITION: 17,
  RESET: 20,
  USER_ID: 32,
  LEADER_BOARD: 49,
  // Not sure what this is yet -- might be ids?
  DONT_KNOW_YET: 50,
  BOARD_SIZE: 64
};

module.exports = buildParser();
module.exports.TYPES = MESSAGE_TYPES;;

function buildParser() {
  var noop = new Parser();

  // Parses a string via String.fromCharCode
  var string = new Parser()
    .array('string', {
      type: 'uint16le',
      readUntil: function(item, buffer) { return item === 0; },
      formatter: function(codes) {
        // Remove the null character
        codes.pop();
        var characters = codes.map(function(code) {
          return String.fromCharCode(code);
        });
        return characters.join('');
      }
    });

  var color = new Parser()
    .uint8('r')
    .uint8('g')
    .uint8('b');

  var consumption = new Parser()
    .uint32le('consumerId')
    .uint32le('consumedId')

  var entityEntry = new Parser()
    .uint32le('id')
    .choice('data', {
      tag: 'id',
      choices: {0: noop},
      defaultChoice: new Parser()
        .int16le('x')
        .int16le('y')
        .int16le('size')
        .nest('color', {
          type: color,
          formatter: function(color) {
            // convert rgb values to a hex string
            var string = (color.r << 16 | color.g << 8 | color.b).toString(16);
            while(string.length < 6) {
              string = '0' + string;
            }

            return '#' + string;
          }
        })
        .uint8('flags')
        .nest('name', {type: string}),
    });

  var updates = new Parser()
    .uint16le('length')
    .array('consumptions', {
      type: consumption,
      length: 'length'
    })
    .array('entities', {
      type: entityEntry,
      readUntil: function(item, buffer) { return item.id === 0; },
      formatter: function(entities) {
        // Remove the last "entity" entry, it is a marker for end of array
        entities.pop();

        // Flatten out the entities
        for (var i = 0; i < entities.length; i++) {
          entities[i].x = entities[i].data.x;
          entities[i].y = entities[i].data.y;
          entities[i].size = entities[i].data.size;
          entities[i].color = entities[i].data.color;
          entities[i].flags = entities[i].data.flags;
          entities[i].name = entities[i].data.name.string;
          delete entities[i].data;
        }

        return entities;
      }
    })
    .uint32le('length')
    .array('destructions', {
      type: 'uint32le',
      length: 'length'
    });

  var userId = new Parser()
    .uint32le('id');

  // Parses a single leader board entry.
  var leaderBoardEntry = new Parser()
    .uint32le('id')
    .nest('name', {type: string});

  // Parses the leader board.
  var leaderBoard = new Parser()
    .uint32le('length')
    .array('leaderBoard', {
      type: leaderBoardEntry,
      length: 'length'
    });

  var boardSize = new Parser()
    .doublele('minX')
    .doublele('minY')
    .doublele('maxX')
    .doublele('maxY');

  var dontKnowYet = new Parser()
    .uint32le('length')
    .array('dontKnowYet', {
      type: 'floatle',
      length: 'length'
    });

  var screenPosition = new Parser()
    .floatle('x')
    .floatle('y')
    .floatle('z');

  var messageChoices = {};
  messageChoices[MESSAGE_TYPES.UPDATES] = updates;
  messageChoices[MESSAGE_TYPES.SCREEN_POSITION] = screenPosition;
  messageChoices[MESSAGE_TYPES.RESET] = noop;
  messageChoices[MESSAGE_TYPES.USER_ID] = userId;
  messageChoices[MESSAGE_TYPES.LEADER_BOARD] = leaderBoard;
  messageChoices[MESSAGE_TYPES.DONT_KNOW_YET] = dontKnowYet;
  messageChoices[MESSAGE_TYPES.BOARD_SIZE] = boardSize;

  // Top level message parser.
  var message = new Parser()
    .uint8('type')
    .choice('data', {
      tag: 'type',
      choices: messageChoices,
      defaultChoice: noop
    });

  return message;
}