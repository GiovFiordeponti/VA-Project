class Model {
  constructor() {
    this.entries = []
    this.dataset = {}
    this.mapData = {}
    this.entriesById = {}
    this.onEntriesListChanged = () => { }
  }
  // 
  bindEntriesListChanged(callback) {
    this.onEntriesListChanged = callback
  }

  addMapData(mapData){
    this.mapData = mapData;
  }
  // 
  addEntry(entry) {
    if (entry.id === undefined) throw new Error('Entry with missing id')
    this.entries.push(entry)
    this.entriesById[entry.id] = this.entries.length - 1
    this.onEntriesListChanged()
  }
  updateEntry(entry, preventDefault) {
    this.entries[this.entriesById[entry.id]] = { ...this.entriesById[entry.id], ...entry }
    !preventDefault && this.onEntriesListChanged()
  }
  deleteEntry(entryId) {
    const entryIndex = this.entriesById[entryId]
    this.entries.splice(entryIndex, 1)
    delete this.entriesById[entryId]
    this.entries.forEach(e => {
      if (this.entriesById[e.id] > entryIndex) this.entriesById[e.id] -= 1
    })
    this.onEntriesListChanged()
  }

  /**
   * add a new record to dataset
   * @param {any} record the record obj to add
   * @param {boolean} isCovid true if is related to covid data, false otherwise (mobility)
   * @param {number} index (optional) tells where the record is stored in the entries array
   */
  addRecord(record, isCovid, index) {
    if (isCovid) {
      // if is covid  data, add to dataset and create unique id
      let id = record.data+"_"+record.codice_regione;
      // find daily day by looking for previous date 
      let dailyDeath = record.deceduti;
      if(record.data != "2020-02-24"){
        let dateFields = record.data.split("-");
        let previousDate = new Date(new Date(Number(dateFields[0]), Number(dateFields[1])-1, Number(dateFields[2])).getTime() - 1000*60*60*24).toLocaleDateString('en-CA');
        let previousDateObj = this.dataset[previousDate+"_"+record.codice_regione];
        dailyDeath = dailyDeath - previousDateObj.deathTotal;
      }
      let obj = {
        id: id,
        date: record.data,
        region: record.codice_regione,
        new: record.nuovi_positivi,
        deathTotal: record.deceduti,
        death: dailyDeath,
        healed: record.dimessi_guariti,
        positives: record.totale_positivi,
        hospitalized: record.totale_ospedalizzati,
        isolated: record.isolamento_domiciliare,
        intensiveCare: record.terapia_intensiva,
      };
      this.entries.push(obj);
      this.dataset[id] = obj;
      this.dataset[id]["index"] = index; // add also index, so we can find it later for mobility
    }
    else if(this.dataset[record.date+"_"+record.sub_region_1]){
      // if it's mobility data, merge to current dataset with unique id
      let oldObj = this.dataset[record.date+"_"+record.sub_region_1];
      let entryIndex = oldObj.index;
      let newObj = Object.assign(this.entries[entryIndex], {
        groceriesPharmacy: record.grocery_and_pharmacy_percent_change_from_baseline,
        parks: record.parks_percent_change_from_baseline,
        residential: record.residential_percent_change_from_baseline,
        retailRecreation: record.retail_and_recreation_percent_change_from_baseline,
        transit: record.transit_stations_percent_change_from_baseline,
        workplaces: record.workplaces_percent_change_from_baseline
      });
      delete newObj.index;
      this.entries[entryIndex] = newObj;
      this.dataset[record.date+"_"+record.sub_region_1] = newObj;
    }
  }
}

export default new Model()
