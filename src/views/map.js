import * as d3 from 'd3'
import { color } from 'd3';

export default function () {
  let data = {},
    width = 250,
    height = 250;

  let updateData;

  // Map and projection
  let projection = d3.geoMercator()
    .center([2, 47])                // GPS of location to zoom on
    .scale(1000)                       // This is like the zoom
    .translate([-width / 4, -height/10000])

  let mapCallback = () => {console.log("map callback")}
  let onClick = (d) => {
    if (data.clickCount < 3 || d.properties.clicked) {
      d.properties.clicked = !d.properties.clicked;
      if(d.properties.clicked){
        // if clicked, add in array
        if(selectedRegions.includes("0")){
          // if whole italy is selected, remove it
          selectedRegions.splice(selectedRegions.indexOf("0"), 1)
        }
        selectedRegions.push(d.properties.reg_istat_code);
        // add to recap
        let node  = document.createElement("p");
        node.setAttribute("style", "color: "+regionColor(d.properties.reg_istat_code)+"; display: inline;");
        node.textContent = d.properties.reg_name+"\t";
        node.id = "regionsRecap"+d.properties.reg_istat_code;
        regionsRecap.appendChild(node);
      }
      else{
        //otherwise, remove from array
        selectedRegions.splice(selectedRegions.indexOf(d.properties.reg_istat_code), 1);
        document.getElementById("regionsRecap"+d.properties.reg_istat_code).remove();
      }
      d.properties.clicked ? data.clickCount++ : data.clickCount--;
      data.wholeMap = data.clickCount == 0;
      if(data.wholeMap){
        selectedRegions.push("0");
      }
      mapCallback();     
      updateData();
      console.log("clicked %o . selected regions: %d", d, data.clickCount);
    }
  }
  const map = function (selection) {
    selection.each(function () {
      const dom = d3.select(this)
      const svg = dom.append('svg')
        .attr('class', 'bar-chart')
        .attr('height', height)
        .attr('width', width);

      updateData = function () {
        
        if (svg.select("#map").empty()) {
          // if map group doesn't exist, create it
          svg.append("g")
            .attr("id", "map");
        }
        
        // Draw the map
        svg.select("#map")
          .selectAll("path")
          .data(data.features) // set features
          .join(
            enter => enter
              .append("path")
              .attr("fill", regionColor(0)) // first time, no region is selected: all white 
              .attr("d", d3.geoPath()
                .projection(projection)
              )
              .style("stroke", "black")
              .on("click", d => {
                onClick(d);
              }),
            update => update
            // change fill property based on the selection
              .call(update => update
                .transition()
                .duration(1000)
                .attr("opacity", d => data.wholeMap ? '1' : (d.properties.clicked ? '1': '.5'))
                .style('fill', d => d.properties.clicked ? regionColor(d.properties.reg_istat_code) : regionColor(0))
              ),
            exit => exit
              .call(exit => exit
                .transition()
                .duration(650)
                .remove()
              )
          )
      }
    })
  }
  //
  map.data = function (_) {
    if (!arguments.length) return data
    data = _
    if (typeof updateData === 'function') updateData()
    return map
  }
  //
  map.bindCallback = (callback) => mapCallback = callback
  //
  return map
}
