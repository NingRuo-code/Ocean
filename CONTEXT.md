# Ocean

Ocean is a fishery-operation analysis context that uses ocean-front events and related marine data to support where-and-when fishing decisions. Its technical research frame is spatiotemporal event representation, matching, comparison, and human-AI visual analysis.

## Language

**Fishery Operation Support**:
A decision-support framing for helping fishing operators judge where to go, when to go, and how strong the evidence is. It should not imply guaranteed catch or automated command.
_Avoid_: Fish finder, automatic fishing decision

**Ocean Front**:
A marine boundary or gradient zone between different water masses, represented in this project by front lines, cold/warm side structure, and related spatial-temporal attributes.
_Avoid_: Generic temperature layer

**Spatiotemporal Front Event**:
A front occurrence treated as an event with location, shape, time, persistence, movement, and possible relation to fishing activity response.
_Avoid_: Single map layer, static front picture

**Fishing Effort**:
The preferred first-stage proxy for fishery activity response, measured by vessel operation or dwelling hours rather than manually reported catch weight.
_Avoid_: Catch tonnage, production volume

**Apparent Fishing Effort**:
Fishing activity estimated from vessel tracking behavior rather than directly observed catch. In this project, it is the preferred computable proxy for fishery activity when using Global Fishing Watch-style AIS products.
_Avoid_: Confirmed fishing, catch volume

**AIS Operation Response**:
The fishery response signal derived from AIS activity after or around a front event, usually summarized as fishing effort within a spatial-temporal window.
_Avoid_: Direct catch, fish biomass

**Front Response Window**:
The temporal window used to compare a front event with apparent fishing effort. The exploratory view shows seven days before and seven days after the event, while the default interpretation focuses on the one-to-three-day response after the front.
_Avoid_: Same-day-only response

**Front Buffer Response**:
The first-stage spatial matching method for summing apparent fishing effort near a front event. Fishing hours are summed inside a buffer around the front rather than requiring both datasets to share an identical grid.
_Avoid_: Exact pixel overlap only

**Operation Range**:
The user-facing radius for searching operation cues around a departure point. The product defaults to 20 km while allowing 10, 20, and 30 km; research analysis reports all three as a sensitivity check.
_Avoid_: Hidden model radius

**Response Baseline**:
The comparison used to decide whether apparent fishing effort increased around a front event. The first stage compares against both the same front buffer before the event and same-day non-front control areas.
_Avoid_: Raw fishing hours without comparison

**Response Strength**:
The evidence summary for whether apparent fishing effort increased around a front event. The product should lead with a qualitative state such as enhanced or not clearly enhanced, while retaining fishing hours, pre-event change, and non-front contrast as supporting numbers.
_Avoid_: Bare fishing-hour total

**Response Enhancement**:
The first-stage threshold for calling an AIS operation response enhanced. The one-to-three-day post-front fishing effort must be at least twenty percent higher than the seven-day pre-front baseline and also higher than same-day non-front control areas.
_Avoid_: Increase without baseline

**Non-Front Control Area**:
A same-day comparison area away from fronts, used to test whether apparent fishing effort near a front is higher than background fishing activity. The first-stage negative samples are same-area buffers at least 50 km away from fronts.
_Avoid_: Arbitrary empty ocean

**Similar Front Event**:
A past front event used for comparison or retrieval. The first stage searches the same sea area within a plus-or-minus fifteen-day seasonal window; shape, length, direction, and intensity are later refinements.
_Avoid_: Any historical front

**Fishing Effort Layer**:
The map-facing layer derived from Global Fishing Watch daily 0.01 degree apparent fishing hours. For display, it may be aggregated to the front-data grid; for analysis, the original finer grid should be preserved when summing inside front buffers.
_Avoid_: Raw AIS layer, catch layer

**Fishing Effort Grid Artifact**:
The frontend-facing daily fishing-effort file aggregated to the 0.05 degree front grid. It supports map display and should not be treated as the source of record for buffer-response calculations.
_Avoid_: Analysis source of truth

**Front Response Table**:
The precomputed event-level table used by evidence blocks and research figures. It includes front event identity, date, front id, buffer radius, pre-event effort, post-event effort, lift, non-front control effort, enhancement flag, and similar-event grouping.
_Avoid_: Frontend-only summary

**Fishery Ground Truth**:
The observed target used to validate fishery-related analysis. In the first stage, this is fishing effort derived from AIS or related vessel activity data, not catch tonnage.
_Avoid_: Fish abundance, guaranteed catch

**Fishery Possibility**:
The product-facing expression for whether an area is worth attention as a possible fishing ground. It is supported by front signals, historical context, and AIS operation response, but it must not be presented as guaranteed production.
_Avoid_: Production forecast, guaranteed yield

**Historical AIS Response Evidence**:
The product-facing evidence block that explains whether similar front situations have historically shown apparent fishing-effort response. It supports the fishery possibility score but does not claim catch or revenue.
_Avoid_: Catch prediction evidence

**Similar Front Response Module**:
The research-facing module for retrieving comparable front events in the same sea area and seasonal window, then comparing their apparent fishing-effort responses.
_Avoid_: Generic history tab

**Operation Cue**:
A user-facing hint about where or when to pay attention for fishing operations. It is weaker than a recommendation and must remain evidence-linked.
_Avoid_: Command, guarantee

**Rule-Based Forecast Reference**:
A transparent forecast-like reference produced from current front signal, historical frequency, persistence, and other explicit factors. It is not a business-grade operational forecast unless validated against historical outcomes.
_Avoid_: Business forecast, AI prediction

**AI Analysis**:
A constrained evidence organizer and task planner that turns user intent into structured analysis and explains computed results. It must not invent scientific values or replace deterministic calculations.
_Avoid_: Free chatbot, autonomous scientific calculator

**Human-AI Visual Analysis**:
An analysis mode where the system combines visual exploration, structured computation, and AI-assisted evidence organization while leaving final interpretation and decisions to the human user.
_Avoid_: Fully automated decision-making

**Product Task**:
Given departure location, operation range, and operation date, help the user identify fishery possibility and operation cues.
_Avoid_: General data browsing

**Product Score**:
The user-facing fishery possibility score. After fishing effort data is integrated, it should combine current front signals with historical AIS operation response, not catch volume.
_Avoid_: Yield score, profit score

**Closure Dataset**:
The first dataset slice used to close the product loop end-to-end. It covers the existing prototype window from 2024-07-01 to 2024-08-31 before expanding to historical August samples from 2015 to 2024.
_Avoid_: Full-history requirement

**Research Metrics**:
The first-stage evaluation family for front-response analysis: before/after fishing-effort lift, front-buffer versus non-front-control contrast, multi-radius consistency across 10/20/30 km, and response-enhancement hit rate when thresholds are used.
_Avoid_: Single headline accuracy

**Public Display Boundary**:
The first-stage publishing boundary for GFW-derived data. The system may be used in local or classroom demonstrations and may show aggregate figures in reports, but should not publicly publish the underlying GFW-derived data files before licensing and attribution requirements are settled.
_Avoid_: Public raw data release

**Research Task**:
Given one or more spatiotemporal front events, analyze whether and how AIS operation response appears around them.
_Avoid_: UI demo task
