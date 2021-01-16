import model from './model'
import views from './views'

class Controller {
  constructor() {
    // Model
    this.model = model
    // Views
    this.barchartAscending = views.barchart()
    this.barchartDescending = views.barchart()
    this.scatter = views.scatter()
    this.time = views.time()
    // Model functions binding
    this.model.bindEntriesListChanged(this.onEntriesListChanged.bind(this))
    // Views functions binding
    this.barchartAscending.bindClick((entry) => this.handleUpdateEntry({ id: entry.id, selected: !entry.selected })).bind(this)
    this.barchartDescending.bindClick((entry) => this.handleUpdateEntry({ id: entry.id, selected: !entry.selected })).bind(this)
  }
  //
  handleAddEntry(entry) {
    this.model.addEntry(entry)
  }

  /** 
   * calls model to add covid data 
   */
  addCovidData(entry, index) {
    this.model.addRecord(entry, true, index)
  }

  /** 
   * calls model to add mobility data 
   */
  addMobilityData(entry) {
    if (entry.sub_region_1 != "" && entry.sub_region_2 == "") {
      // add only if its related to only the region in general
      this.model.addRecord(entry, false)
    }
  }

  saveDataset() {
    let header = Object.keys(this.model.entries[0])
    let csv = [
      header.join(','), // header row first
      ...this.model.entries.map(row => header.map(fieldName => row[fieldName]).join(','))
    ].join('\r\n')

    let uriContent = "data:text/csv," + encodeURIComponent(csv);
    window.open(uriContent, '');
  }

  handleUpdateEntry(entry) {
    this.model.updateEntry(entry)
  }
  handleDeleteEntry(entryId) {
    this.model.deleteEntry(entryId)
  }
  //
  onEntriesListChanged() {
    this.barchartAscending.data(this.model.entries);
    this.barchartDescending.data(this.model.entries.slice().reverse());
    // scatter 
    this.scatter.data(this.model.entries);
    // time series
    this.time.data(this.model.entries);
  }

  updateEntries() {
    console.log("update dates", start, finish, selectedRegion);
    start.max = finish.value;
    finish.min = start.value;
    let daysPerRegion = Object.keys(this.model.entriesById);
    let idsToChange = daysPerRegion.filter(id => {
      let date = id.split("_")[0];
      return new Date(start.value) <= new Date(date) && new Date(finish.value) >= new Date(date)
    });

    this.model.entries = this.model.entries.map(e => {
      e.selected = false;
      return e;
    });

    idsToChange.forEach(id => {
      let entry = this.model.entries[this.model.entriesById[id]];
      if (entry && entry.region == selectedRegion) {
        entry.selected = true;
      }
    });

    this.model.onEntriesListChanged();

  }
}

export default new Controller()
