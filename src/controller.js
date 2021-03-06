import model from './model'
import views from './views'
import * as d3 from 'd3'
import { functions } from './util'

class Controller {
  constructor() {
    this.divs = {
      "map-cnt": {
        width: "30%"
      }, 
      "time-cnt": {
        width: "70%"
      }, 
      "boxplot-cnt": {
        width: "40%"
      }, 
      "scatter-cnt": {
        width: "60%"
      }
    }
    this.reduce = false;
    // Model
    this.model = model
    // Views
    this.barchartAscending = views.barchart();
    this.barchartDescending = views.barchart();
    this.scatter = views.scatter();
    this.time = views.time();
    this.boxplot = views.boxplot();
    this.mapView = views.mapView();
    // Model functions binding
    this.model.bindEntriesListChanged(this.onEntriesListChanged.bind(this))
    // Views functions binding
    this.boxplot.bindBrush((brushMode, d, brush, views, field) => this.onBrushChanged(brushMode, d, brush, views, field)).bind(this);
    this.boxplot.bindBrushComplete((views) => this.onBrushCompleted(views)).bind(this);
    this.time.bindBrush((brushMode, d, brush, views, field) => this.onBrushChanged(brushMode, d, brush, views, field)).bind(this);
    this.time.bindBrushComplete((views, restCall) => this.onBrushCompleted(views, restCall)).bind(this);
    this.scatter.bindBrush((brushMode, d, brush, views, field) => this.onBrushChanged(brushMode, d, brush, views, field)).bind(this);
    this.scatter.bindBrushComplete((views, restCall) => this.onBrushCompleted(views, restCall)).bind(this);
    this.mapView.bindCallback(() => {
      start.value = "2020-02-24";
      finish.value = "2020-12-31";
      this.timeBrush = false;
      this.boxBrush = false;
      this.scatterBrush = false;
      this.scatter.setZoomMode(false);
      brushMobilityButton.disabled = true;
      this.onMapUpdated();
      this.computeAggregate(true);
    }).bind(this);
    // brush
    this.timeBrush = false;
    this.boxBrush = false;
    this.scatterBrush = false;
    this.aggregate = true;

    this.daySelected = [0, 1, 2, 3, 4, 5, 6];// days of week

    this.timeFormat = null;
  }

  handleMapData(mapData) {
    mapData.features[3].properties.reg_istat_code = 22// change trentino istat 
    this.model.addMapData(mapData)
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

  handleUpdateEntry(entry, preventDefault) {
    this.model.updateEntry(entry, preventDefault)
  }
  handleDeleteEntry(entryId) {
    this.model.deleteEntry(entryId)
  }
  //
  setRecordText(){
    selectedRecords.textContent = this.model.entries.filter(d => {
      return d.selectedRegion && functions.isDrawable(d, this.timeBrush, this.boxBrush, this.scatterBrush)
    }).length;
  }
  onEntriesListChanged(views) {
    // first: update counter
    this.setRecordText();
    // if views are specified, update only them
    if (views && Array.isArray(views)) {
      views.forEach(view => {
        if (view == "map") {
          this.mapView.data(this.model.mapData, this.model.entries);
        }
        else {
          this[view].data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush);
        }
      });
    }
    else {
      // time series
      this.time.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush, this.daySelected);
      // boxplot
      this.boxplot.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush);
      // map data
      this.mapView.data(this.model.mapData, this.model.entries);
    }
  }

  zoomDiv(divToZoom, button){
    Object.keys(this.divs).forEach(div =>{
      let currentDiv = document.getElementById(div)
      if(div!=divToZoom){
        console.log("setting %s to none", div, currentDiv)
        currentDiv.style.display = this.reduce ? "flex" : "none"
      }
      else{
        currentDiv.style.width = this.reduce ? this.divs[div].width : "100%"
        currentDiv.style.height = this.reduce ? "45.5vh" : "90vh"
      }
    })
    this.reduce = !this.reduce
    if(this.reduce) {
      document.querySelector(`#${divToZoom} .fa-expand`).style.display = "none";
      document.querySelector(`#${divToZoom} .fa-compress`).style.display = "initial";
    }
    else {
      document.querySelector(`#${divToZoom} .fa-compress`).style.display = "none";
      document.querySelector(`#${divToZoom} .fa-expand`).style.display = "initial";
    }
  }

  onTimeUpdated(){
    this.timeBrush = true;
    this.onMapUpdated()
    this.scatter.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush, this.aggregate);
  }
  onMapUpdated() {
    console.log("update dates", new Date(start.value), new Date(finish.value), selectedRegions);
    start.max = finish.value;
    finish.min = start.value;
    let daysPerRegion = Object.keys(this.model.entriesById);
    let idsToChange = daysPerRegion.filter(id => {
      let regionId = id.split("_")[1];
      return selectedRegions.filter(region => { return regionId == region.id }).length > 0;
    });

    this.model.entries = this.model.entries.map(e => {
      e.selectedTime = false;
      e.selectedRegion = false;
      e.selectedMobility = true;
      //e.selectedScatter = true;
      return e;
    });

    idsToChange.forEach(id => {
      let entry = this.model.entries[this.model.entriesById[id]];
      if (entry) {
        entry.selectedRegion = true;
        let date = new Date(id.split("_")[0]);
        entry.selectedTime = new Date(start.value) <= date && new Date(finish.value) >= date && this.daySelected.includes(date.getDay());
      }
    });
    this.model.onEntriesListChanged();
  }

  updateTimeSeries() {
    this.time.updateY(selectedTimeType, this.model.entries);
    // map data
    this.mapView.data(this.model.mapData, this.model.entries);
  }

  updateBoxPlot() {
    this.boxplot.updateY(selectedMobility, this.model.entries);
  }

  /**
   * callback raised whenever a new portion of a vis is brushed by the user
   * @param {any} s 
   */
  onBrushChanged(brushMode, d, brush, views, field) {
    if (true) {
      d[field] = brush;
      if (field == "selectedMobility") {
        this.boxBrush = true;
      }
      else if (field == "selectedScatter") {
        this.scatterBrush = true;
      }
      else if (field == "selectedTime") {
        this.timeBrush = true;
        this.boxBrush = false;
        brushMobilityButton.disabled = true;
      }
      this.handleUpdateEntry(d, true);
    }
    //else {
    //  this.model.entries = this.model.entries.map(e => {
    //    let date = e.id.split("_")[0];
    //   e.selectedMobility = new Date(start.value) <= new Date(date) && new Date(finish.value) >= new Date(date) && selectedRegions.includes(e.region);
    //    return e;
    //  });
    // reset brush
    //}

    //Array.isArray(views) && views.forEach(view => {
    //  this[view].setBrushMode(brushMode);
    //})
  }

  onBrushCompleted(views, restCall) {
    this.model.onEntriesListChanged(views);
  }

  changeTimeHandler(event) {
    selectedTimeType = covidChoice.value;
    console.log("selectedTimeType is ", selectedTimeType);
    window.app.updateTimeSeries();
    window.app.updateBoxPlot();
  }

  changeMobilityHandler(event) {
    let confirmChange = !this.boxBrush ? true : confirm("if you change mobility, all current filters will be lost. Proceed?")
    if (confirmChange) {
      // update view
      this.boxBrush = false;
      brushMobilityButton.disabled = true;
      selectedMobility = mobilityChoice.value;
      console.log("selectedMobility is ", selectedMobility);
      this.model.entries = this.model.entries.map(e => {
        let date = new Date(e.id.split("_")[0]);
        e.selectedMobility = false;
        e.selectedTime = new Date(start.value) <= date && new Date(finish.value) >= date && this.daySelected.includes(date.getDay());
        return e;
      });
      //this.updateTimeSeries();
      this.updateBoxPlot();
      this.scatter.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush, false);
      this.onEntriesListChanged();
    }
    else {
      // restore select
      mobilityChoice.value = selectedMobility;
    }
  }

  clearMobility() {
    this.boxBrush = false;
    this.boxplot.setBrushMode(false);
    this.scatter.setBrushMode(false);
    this.boxplot.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush);
    this.time.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush);
    this.scatter.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush, false);
    brushMobilityButton.disabled = true;
    this.setRecordText();
  }

  clearTime() {
    // reset time zoom mode
    brushTime.checked = true;
    this.time.setZoomMode(false);
    this.timeBrush = false;
    this.boxBrush = false;
    this.boxplot.setBrushMode(false);
    //this.scatter.setBrushMode(false);
    this.time.setBrushMode(false);
    start.value = "2020-02-24";
    finish.value = "2020-12-31";
    document.querySelectorAll('input[type=checkbox][name="week"]').forEach(radio => {
      radio.checked = true
    })
    this.daySelected = [0, 1, 2, 3, 4, 5, 6];// days of week
    this.onMapUpdated();
    this.scatter.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush, this.aggregate);
    brushTimeButton.disabled = true;
    this.setRecordText();
  }

  clearScatter() {
    // checkbox reset
    clusterCheckDiv.querySelectorAll("*").forEach(checkbox => {
      if (checkbox.type == "checkbox") {
        checkbox.checked = true;
      }
    })
    // reset scatter zoom mode
    brushScatter.checked = true;
    this.scatter.setZoomMode(false);
    this.scatterBrush = false;
    //this.onMapUpdated();
    this.boxplot.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush);
    this.time.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush);
    this.scatter.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush, this.aggregate);
    brushScatterButton.disabled = true;
    this.setRecordText();
  }

  canSelectData(data) {
    if (data.selectedRegion) {
      if (this.boxBrush && this.timeBrush) {
        return data.selectedTime && data.selectedMobility
      }
      if (this.boxBrush) {
        return data.selectedMobility
      }
      else if (this.timeBrush) {
        return data.selectedTime
      }
      else {
        return true;
      }
    }
    else {
      return false;
    }
  }

  computeAggregate(updateAggregateField) {
    /** ui check */
    // Show loader, hide scatterplot
    document.getElementById('loader').style.display = "flex";
    document.querySelector("#scatter-cnt svg").style.display = "none";

    computeButton.disabled = true; // disable button
    let clusters = clusterNumber.value;
    this.setClusterCheck();
    clusterNumber.disabled = true;
    textCluster.textContent = clusters
    /** find index of the element to compute */
    let indexToCompute = this.model.entries.map((data, index) => {

      if (this.canSelectData(data)) {
        return (index + 1)
      }
      else {
        return -1
      }
    }).filter((index) => {
      return index != -1;
    });
    // create json obj
    let request = {
      "selRowNums": indexToCompute,
      "clusters": clusters
    }
    console.log("sending data %o to backend", request);
    /** create xmlhttp req */
    const xmlhttp = new XMLHttpRequest();   // new HttpRequest instance 
    let url = "https://ai18.pythonanywhere.com/dim-reduction";
    xmlhttp.open("POST", url);
    xmlhttp.setRequestHeader("Content-Type", "application/json");
    xmlhttp.setRequestHeader('Access-Control-Allow-Origin', '*');
    xmlhttp.setRequestHeader('Accept', '/*/');
    // reset values
    this.model.entries = this.model.entries.map(entry => {
      if (entry["Y1"]) delete entry["Y1"]
      if (entry["Y2"]) delete entry["Y2"]
      if (entry["cluster"]) delete entry["cluster"]
      return entry
    })
    xmlhttp.send(JSON.stringify(request));
    xmlhttp.onreadystatechange = (function (resp) { // Call a function when the state changes.
      if (resp.target.readyState === XMLHttpRequest.DONE && resp.target.status === 200) {
        // Request finished. Do processing here.
        let response = JSON.parse(resp.target.responseText).clusters;
        console.log("received response: %o", response);

        indexToCompute.forEach((recordIndex, index) => {
          let entry = this.model.entries[recordIndex - 1];
          let responseData = response[index];
          entry["Y1"] = responseData[0];
          entry["Y2"] = responseData[1];
          entry["cluster"] = responseData[2];
        });

        // Hide loader, show scatter plot
        document.getElementById('loader').style.display = "none";
        document.querySelector("#scatter-cnt svg").style.display = "initial";

        computeButton.disabled = false; // disable button
        clusterNumber.disabled = false;

        this.aggregate = updateAggregateField || !this.aggregate;

        this.scatter.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush, this.aggregate);
        //this.boxplot.data(this.model.entries, this.boxBrush, this.timeBrush);
      }
    }).bind(this)
  }

  updateClusterNumber() {
    textCluster.textContent = clusterNumber.value
  }

  setDays() {
    this.timeBrush = this.daySelected.length < 7 ? true : (start.value != "2020-02-24" && finish.value != "2020-12-31");
    brushTimeButton.disabled = !this.timeBrush;
    this.model.entries.forEach(entry => {
      entry.selectedTime = this.timeFormat(start.value) <= entry.date && this.timeFormat(finish.value) >= entry.date && this.daySelected.includes(entry.date.getDay());
    });
    this.scatter.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush, this.aggregate);
    this.model.onEntriesListChanged();
  }

  setClusters() {
    let currentClusters = clusterCheckDiv.querySelectorAll("*").length;
    let selectedClusters = 0;
    clusterCheckDiv.querySelectorAll("*").forEach(checkbox => {
      if (checkbox.checked) {
        selectedClusters++
      }
    })
    this.scatterBrush = selectedClusters < currentClusters
    brushScatterButton.disabled = !this.scatterBrush;
    this.model.entries.forEach(entry => {
      if (entry && entry.cluster != null) {
        entry.selectedScatter = document.getElementById("clusterCheck" + entry.cluster).checked
      }
    });
    this.scatter.data(this.model.entries, this.boxBrush, this.timeBrush, this.scatterBrush, false);
    this.model.onEntriesListChanged();
  }

  setClusterCheck() {
    // remove previous children
    clusterCheckDiv.querySelectorAll("*").forEach(node => node.remove())
    if (clusterNumber.value > 1) {
      // add only if more than one cluster is selected
      for (let i = 0; i < clusterNumber.value; i++) {
        let clusterCheck = document.createElement("input")
        let clusterLabel = document.createElement("label")
        clusterCheck.setAttribute("type", "checkbox")
        clusterCheck.setAttribute("id", "clusterCheck" + i)
        clusterCheck.setAttribute("value", i)
        clusterCheck.setAttribute("checked", true)
        clusterCheck.addEventListener("change", this.setClusters.bind(this));
        clusterLabel.setAttribute("for", clusterCheck.id)
        clusterLabel.innerText = "Cluster " + (i + 1)
        clusterCheckDiv.appendChild(clusterCheck)
        clusterCheckDiv.appendChild(clusterLabel)
      }
    }
  }

  credits(){
    alert(
      "Datasets:\n"+
      "- Dati COVID-19 Italia [pcm-dpc] (CC-BY-4.0)\n"+
      "https://github.com/pcm-dpc/COVID-19\n"+
      "- COVID-19 Community Mobility Reports [google] (CC-BY-4.0)\n"+
      "https://www.google.com/covid19/mobility/\n\n"+
      "Authors:\n"+
      "- Giovanni Fiordeponti\n"+
      "- Antonio Ionta\n"+
      "- Silvia Marchiori\n"
    )
  }

  collapsible(cntId) {
    let coll = document.querySelector(`#${cntId} .collapsible`);

    coll.classList.toggle("active");
    
    let content = document.querySelector(`#${cntId} .menu-cnt`);
    if (!content.style.display || content.style.display == "none") {
      content.style.display = "flex";
      let h = document.querySelector(`#${cntId} .header`).offsetHeight;
      content.style.top = `${h}px`;
      document.querySelector(`#${cntId} .fa-chevron-down`).style.display = "none";
      document.querySelector(`#${cntId} .fa-chevron-up`).style.display = "initial";
    }
    else {
      content.style.display = "none";
      document.querySelector(`#${cntId} .fa-chevron-up`).style.display = "none";
      document.querySelector(`#${cntId} .fa-chevron-down`).style.display = "initial";
    }
  }

}

export default new Controller()
