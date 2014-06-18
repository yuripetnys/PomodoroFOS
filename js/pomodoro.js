DeviceDetector = {}
DeviceDetector.FirefoxOSRegex = /Mozilla\/\d*\.\d* \((Mobile|Tablet); rv:\d*\.\d*\) Gecko\/\d*\.\d* Firefox\/\d*\.\d*/
DeviceDetector.IOSRegex = /(iPad|iPhone|iPod)/
DeviceDetector.IsIOS = function () {
    return DeviceDetector.IOSRegex.test( navigator.userAgent );
}
DeviceDetector.IsFirefoxOS = function () {
    return DeviceDetector.FirefoxOSRegex.test(navigator.userAgent);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

Util = {};
Util.formatTimeDifference = function(seconds) {
    var hour = Math.floor(seconds / 3600);
    var min = Math.floor(seconds / 60) % 60;
    var sec = seconds % 60;
    
    return (hour > 0 ? hour + "h " : "") + (min > 0 ? Util.addLeadingZeros(min,2) + "m " : "") + Util.addLeadingZeros(sec,2) + "s";
    return hour + "m " + sec + "s";
}
Util.addLeadingZeros = function(number, desiredDigitCount) {
    var strNum = number.toString();
    var numOfZeros = desiredDigitCount - strNum.length;
    if (numOfZeros > 0)  return new Array(numOfZeros + 1).join("0") + strNum;
    return strNum;
}
Util.redirectToPaypal = function() {
	if (DeviceDetector.IsFirefoxOS() && "MozActivity" in window) {
		var a = new MozActivity({
			name: "view",
			data: {
				type: "url",
				url: "http://polei.ro/pomodoro/paypal.htm"
			}
		});
	} else {
		document.getElementById('paypalForm').submit();
	}
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

AudioManager = {}
AudioManager.Alarm = new Audio();
AudioManager.Alarm.mozaudiochannel = "alarm";
AudioManager.load = function () { 
    AudioManager.Alarm.src = "aud/vuvuzela.mp3"; 
    AudioManager.Alarm.load();
}
AudioManager.play = function () {
    AudioManager.Alarm.play();
}
if (!DeviceDetector.IsIOS()) AudioManager.load();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

NotificationManager = {}
NotificationManager.LastNotification = null;
if (DeviceDetector.IsFirefoxOS()) {
	NotificationManager.IconURL = "app://" + window.location.host + "/images/icon-128.png";
} else {
	NotificationManager.IconURL = "/images/icon-128.png";
}
NotificationManager.requestNotificationPermission = function() {
    if ("Notification" in window) {
        Notification.requestPermission(function (permission) { 
            Notification.permission = permission; 
        });
    }
}
NotificationManager.notifyUser = function(message, closeLastNotification) {
    if ("Notification" in window) {
        if (!("permission" in Notification) || (Notification.permission === "default")) {
            NotificationManager.requestNotificationPermission();
        }
        
        if (Notification.permission !== "denied") {
            if (closeLastNotification && !!(NotificationManager.LastNotification)) NotificationManager.LastNotification.close();
            NotificationManager.LastNotification = new Notification('Pomodoro do Arara', { body: message, icon: NotificationManager.IconURL });
        }
    } 
    if ("mozNotification" in navigator) {
        navigator.mozNotification.createNotification('Pomodoro do Arara', message, NotificationManager.IconURL).show();
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

ConfigManager = {}
ConfigManager.init = function (manager) {
    if ("localStorage" in window) {        
        ConfigManager.updateVersion();
    
        if ("CurrentTaskName" in localStorage) manager.CurrentTaskName(localStorage.CurrentTaskName);
        if ("WorkTime" in localStorage) manager.WorkTime(localStorage.WorkTime * 1);
        if ("ShortBreakTime" in localStorage) manager.ShortBreakTime(localStorage.ShortBreakTime * 1);
        if ("MaxShortBreaks" in localStorage) manager.MaxShortBreaks(localStorage.MaxShortBreaks * 1);
        if ("LongBreakTime" in localStorage) manager.LongBreakTime(localStorage.LongBreakTime * 1);
        if ("Entries" in localStorage) manager.Entries(JSON.parse(localStorage.Entries).map(function (element) { return PomodoroEntry.Deserialize(element); }));
        if ("EnableAudioNotifications" in localStorage) manager.EnableAudioNotifications(!!localStorage.EnableAudioNotifications);
        if ("EnablePopupNotifications" in localStorage) manager.EnablePopupNotifications(!!localStorage.EnablePopupNotifications);
        if ("EnableVibration" in localStorage) manager.EnableVibration(!!localStorage.EnableVibration);
        if ("RemoveOldNotifications" in localStorage) manager.RemoveOldNotifications(!!localStorage.RemoveOldNotifications);
        
        manager.CurrentTaskName.subscribe(function(newValue) { localStorage.CurrentTaskName = newValue; });
        manager.WorkTime.subscribe(function(newValue) { localStorage.WorkTime = newValue; });
        manager.ShortBreakTime.subscribe(function(newValue) { localStorage.ShortBreakTime = newValue; });
        manager.MaxShortBreaks.subscribe(function(newValue) { localStorage.MaxShortBreaks = newValue; });
        manager.LongBreakTime.subscribe(function(newValue) { localStorage.LongBreakTime = newValue; });
        manager.Entries.subscribe(function(newValue) { localStorage.Entries = JSON.stringify(newValue.map(PomodoroEntry.Serialize)); });
        manager.EnableAudioNotifications.subscribe(function(newValue) { localStorage.EnableAudioNotifications = newValue; });
        manager.EnablePopupNotifications.subscribe(function(newValue) { localStorage.EnablePopupNotifications = newValue; });
        manager.EnableVibration.subscribe(function(newValue) { localStorage.EnableVibration = newValue; });
        manager.RemoveOldNotifications.subscribe(function(newValue) { localStorage.RemoveOldNotifications = newValue; });
    }
}
ConfigManager.updateVersion = function () {
    if (typeof(localStorage.Version)=="undefined") {
        console.log("Updating to version 1.0...");
        localStorage.Version = "1.0";
        localStorage.removeItem("Entries");
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

PomodoroEntry = function() { 
    this.Name = "";
    this.State = 0;
    this.Start = ko.observable(null);
    this.End = ko.observable(null);
    this.FormattedStart = ko.computed(function() { return !!this.Start() ? this.Start().format("MMM DD HH:mm") : ""; }, this);
    this.FormattedEnd = ko.computed(function() { return !!this.End() ? this.End().format("MMM DD HH:mm") : ""; }, this);
	this.FormattedStartDate = ko.computed(function() { return !!this.Start() ? this.Start().format("YYYY/MM/DD") : ""; }, this);
	this.FormattedStartTime = ko.computed(function() { return !!this.Start() ? this.Start().format("HH:mm") : ""; }, this);
	this.FormattedEndDate = ko.computed(function() { return !!this.End() ? this.End().format("YYYY/MM/DD") : ""; }, this);
	this.FormattedEndTime = ko.computed(function() { return !!this.End() ? this.End().format("HH:mm") : ""; }, this);
    this.Difference = ko.computed(function() { 
        if (!!this.Start() && !!this.End()) {
            var diff = this.End().diff(this.Start(), "seconds");
            return Util.formatTimeDifference(diff);
        } else return "";
    }, this);
}

PomodoroEntry.Serialize = function(entry) {
    var a = {};
    a.Name = entry.Name;
    a.State = entry.State;
    a.Start = entry.Start().toJSON();
    a.End = entry.End().toJSON();
    return a;
}
PomodoroEntry.Deserialize = function(jsonObject) {
    var a = new PomodoroEntry();
    a.Name = jsonObject.Name;
    a.State = jsonObject.State;
    a.Start(moment(jsonObject.Start));
    a.End(moment(jsonObject.End));
    return a;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

PomodoroSummaryEntry = function() {
    this.Name = "";
    this.WorkTime = ko.observable(0);
    this.BreakTime = ko.observable(0);
    this.PauseTime = ko.observable(0);
	this.LeisureTime = ko.computed(function() { return this.BreakTime() + this.PauseTime(); }, this);
    this.TotalTime = ko.computed(function() { return this.WorkTime() + this.BreakTime() + this.PauseTime(); }, this);
	
    this.FormattedWorkTime = ko.computed(function()  { return Util.formatTimeDifference(this.WorkTime()); }, this);
    this.FormattedBreakTime = ko.computed(function() { return Util.formatTimeDifference(this.BreakTime()); }, this);
    this.FormattedPauseTime = ko.computed(function() { return Util.formatTimeDifference(this.PauseTime()); }, this);
	this.FormattedTotalTime = ko.computed(function() { return Util.formatTimeDifference(this.TotalTime()); }, this);
	this.FormattedLeisureTime = ko.computed(function() { return Util.formatTimeDifference(this.LeisureTime()); }, this);
}
PomodoroSummaryEntry.prototype.addTime = function(seconds, state) {
    if (state == PomodoroManagerState.WORKING) {
        this.WorkTime(this.WorkTime() + seconds);
    } else if (state == PomodoroManagerState.SHORTBREAK || state == PomodoroManagerState.LONGBREAK) {
        this.BreakTime(this.BreakTime() + seconds);
    } else if (state == PomodoroManagerState.POTTYPAUSE) {
        this.PauseTime(this.PauseTime() + seconds);
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

PomodoroManagerState = {}
PomodoroManagerState.IDLE = 0;
PomodoroManagerState.WORKING = 1;
PomodoroManagerState.SHORTBREAK = 2;
PomodoroManagerState.LONGBREAK = 3;
PomodoroManagerState.POTTYPAUSE = 4;
PomodoroManagerState.getStateName = function (state) {
    if (state == PomodoroManagerState.IDLE) {
        return "Idle";
    } else if (state == PomodoroManagerState.WORKING) {
        return "Working";
    } else if (state == PomodoroManagerState.SHORTBREAK) {
        return "Short Break";
    } else if (state == PomodoroManagerState.LONGBREAK) {
        return "Long Break";
    } else if (state == PomodoroManagerState.POTTYPAUSE) {
        return "Potty Pause";
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function PomodoroManager() {
    this.CurrentEntry = null;
    this.ShortBreakCount = 0;
    this.IntervalID = null;
    this.StateBeforePause = null;
	this.TargetTime = null;
	
    this.State = ko.observable(PomodoroManagerState.IDLE);
    this.Entries = ko.observableArray();
    this.SummaryEntries = ko.observableArray();
    this.CurrentTaskName = ko.observable("New Task");	
    this.FormattedTimer = ko.observable("00:00");
    
    this.WorkTime = ko.observable(25);
    this.ShortBreakTime = ko.observable(5);
    this.MaxShortBreaks = ko.observable(3);
    this.LongBreakTime = ko.observable(15);
    this.EnableAudioNotifications = ko.observable(true);
    this.EnablePopupNotifications = ko.observable(true);
    this.EnableVibration = ko.observable(true);
    this.RemoveOldNotifications = ko.observable(false);
}

PomodoroManager.prototype.init = function() {
    ConfigManager.init(this);
    
    if (this.EnablePopupNotifications()) NotificationManager.requestNotificationPermission();
    
    window.onbeforeunload = function (e) {
        e = e || window.event;
        
        if (PM.State() == PomodoroManagerState.IDLE) { return null; }
        if (e) { e.returnValue = "There's a Pomodoro running right now." }
        return "There's a Pomodoro running right now.";
    };
    
    ko.applyBindings(this);
}

PomodoroManager.prototype.startTimer = function() {
    var promptResult = this.promptForNewTask();
    
    if (!promptResult) return false;

	if (DeviceDetector.IsIOS()) AudioManager.load();
	this.State(PomodoroManagerState.WORKING);
	this.resetTimer();
	this.startEntry();
	if (this.EnablePopupNotifications()) NotificationManager.requestNotificationPermission();
	
	this.IntervalID = setInterval(this.loop(this), 1000);
	
	return true;
}
PomodoroManager.prototype.changeTask = function() {
    var oldTask = this.CurrentTaskName();
    
    this.promptForNewTask();
        
    if (this.CurrentTaskName() != oldTask) {
        this.endEntry();
        this.startEntry();
    }
}
PomodoroManager.prototype.stopTimer = function() {    
    this.endEntry();
    this.State(PomodoroManagerState.IDLE);
    this.resetTimer();
    clearInterval(this.IntervalID);
	return true;
}
PomodoroManager.prototype.pottyPause = function() {
	this.endEntry();
	
    if (this.State() != PomodoroManagerState.POTTYPAUSE)
    {
        clearInterval(this.IntervalID);
		this.StateBeforePause = this.State();
        this.State(PomodoroManagerState.POTTYPAUSE);
    }
    else
    {
        this.State(this.StateBeforePause);
        this.IntervalID = setInterval(this.loop(this), 1000);
    }
	
	this.startEntry();
}
PomodoroManager.prototype.loop = function(manager) {
    return function() {
        currentTime = moment();
		
        if (manager.TargetTime.isBefore(currentTime))
        {
            manager.endEntry();
            manager.goToNextState();
            manager.startEntry();
			
            if (manager.EnablePopupNotifications()) 
				NotificationManager.notifyUser("Starting a " + PomodoroManagerState.getStateName(manager.State()) + " Pomodoro now!", manager.RemoveOldNotifications());
            if (manager.EnableAudioNotifications() && !(DeviceDetector.IsFirefoxOS() && manager.EnablePopupNotifications())) 
				AudioManager.play();
            if ("vibrate" in window.navigator && manager.EnableVibration()) 
				window.navigator.vibrate([200,100,200,100,200]);
        }
		else
		{
			manager.updateFormattedTimer(currentTime);
		}
    }
}
PomodoroManager.prototype.goToNextState = function() {
    if (this.State() == PomodoroManagerState.SHORTBREAK) {
        this.ShortBreakCount = this.ShortBreakCount + 1;
        this.State(PomodoroManagerState.WORKING);
    } else if (this.State() == PomodoroManagerState.LONGBREAK) {
        this.ShortBreakCount = 0;
        this.State(PomodoroManagerState.WORKING);
    } else if (this.ShortBreakCount == this.MaxShortBreaks()) {
		this.State(PomodoroManagerState.LONGBREAK);
	} else {
		this.State(PomodoroManagerState.SHORTBREAK);
	}
	
	this.resetTimer();
}
PomodoroManager.prototype.clearAllEntries = function() {
    this.Entries.removeAll();
}
PomodoroManager.prototype.promptForNewTask = function() {
    var taskname = window.prompt("What are you going to do now?", this.CurrentTaskName());
    
    if (taskname == null) {
        return false;
    } else {
        this.CurrentTaskName(!!taskname ? taskname : "New task");
        return true;
    }    
}
PomodoroManager.prototype.startEntry = function() {
    var newEntry = new PomodoroEntry();
    newEntry.Name = !!this.CurrentTaskName() ? this.CurrentTaskName() : "Unnamed Task";
    newEntry.State = this.State();
    newEntry.Parent = this;
    newEntry.Start(moment());
    this.CurrentEntry = newEntry;
}
PomodoroManager.prototype.endEntry = function() {
    this.CurrentEntry.End(moment());
    this.Entries.unshift(this.CurrentEntry);
    this.CurrentEntry = null;
}
PomodoroManager.prototype.updateFormattedTimer = function(currentTime) {
	this.FormattedTimer(moment(this.TargetTime).subtract(currentTime).format("mm:ss"));
}
PomodoroManager.prototype.resetTimer = function() {
    a = 0;
	
	if (this.State() == PomodoroManagerState.WORKING) {
        a = this.WorkTime();
    } else if (this.State() == PomodoroManagerState.SHORTBREAK) {
        a = this.ShortBreakTime();
    } else if (this.State() == PomodoroManagerState.LONGBREAK) {
        a = this.LongBreakTime();
    } else if (this.State() == PomodoroManagerState.IDLE) {
        a = 0;
    }
	
	currentTime = moment();
	this.TargetTime = moment(currentTime).add('minutes', a);
	this.updateFormattedTimer(currentTime);
}
PomodoroManager.prototype.clearEntry = function (entry) {
    this.Parent.Entries.remove(entry);
}

PomodoroManager.prototype.updateSummary = function () {
    var newSummary = [];
    var entriesCache = this.Entries();
    for (var i in entriesCache) {
        var name = entriesCache[i].Name;
        var seconds = entriesCache[i].End().diff(entriesCache[i].Start(), 'seconds');
        var state = entriesCache[i].State;
        
        var existingSummaryRecords = newSummary.filter(function(e) { return e.Name == name; });
        
        if (existingSummaryRecords.length == 0) {
            var newSummaryEntry = new PomodoroSummaryEntry();
            newSummaryEntry.Name = name;
            newSummaryEntry.addTime(seconds, state);
            newSummary.push(newSummaryEntry);
        }
        else if (existingSummaryRecords.length == 1) {
            existingSummaryRecords[0].addTime(seconds, state);
        }
    }
    this.SummaryEntries(newSummary);
}