/**
 * Converts array of Big Numbers to number array 
 */
function arrayOfBNToArray(array) {
    return array.join().split(",").map(v => +v);
}

module.exports = {
    arrayOfBNToArray: arrayOfBNToArray
};