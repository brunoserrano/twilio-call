// Welcome to the main entry point of the app.
//
// In this file, we'll be kicking off our app or storybook.

import "./i18n"
import React, { useState, useEffect } from "react"
import { YellowBox, PermissionsAndroid, Platform, TouchableHighlight, View, TouchableOpacity, ActivityIndicator, Alert, Keyboard, TextInput } from "react-native"
import { StatefulNavigator, BackButtonHandler, exitRoutes } from "./navigation"
import { RootStore, RootStoreProvider, setupRootStore } from "./models/root-store"
import Twilio from "react-native-twilio-programmable-voice"

import { contains } from "ramda"
import { enableScreens } from "react-native-screens"
import { Screen, Text, TextField, Button } from "./components"
import { color } from "./theme"

// This puts screens in a native ViewController or Activity. If you want fully native
// stack navigation, use `createNativeStackNavigator` in place of `createStackNavigator`:
// https://github.com/kmagiera/react-native-screens#using-native-stack-navigator
enableScreens()

/**
 * Ignore some yellowbox warnings. Some of these are for deprecated functions
 * that we haven't gotten around to replacing yet.
 */
YellowBox.ignoreWarnings([
  "componentWillMount is deprecated",
  "componentWillReceiveProps is deprecated",
  "Require cycle:",
])

/**
 * Storybook still wants to use ReactNative's AsyncStorage instead of the
 * react-native-community package; this causes a YellowBox warning. This hack
 * points RN's AsyncStorage at the community one, fixing the warning. Here's the
 * Storybook issue about this: https://github.com/storybookjs/storybook/issues/6078
 */
const ReactNative = require("react-native")
Object.defineProperty(ReactNative, "AsyncStorage", {
  get(): any {
    return require("@react-native-community/async-storage").default
  },
})

/**
 * Are we allowed to exit the app?  This is called when the back button
 * is pressed on android.
 *
 * @param routeName The currently active route name.
 */
const canExit = (routeName: string) => contains(routeName, exitRoutes)

const getAuthToken = () => {
  return fetch('http://b8a63657.ngrok.io/accessToken', {
    method: 'get'
  })
  .then(response => response.text())
  .catch(error => console.error(error))
}

const getMicrophonePermission = () => {
  const audioPermission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO

  return PermissionsAndroid.check(audioPermission).then(async result => {
    if (!result) {
      const granted = await PermissionsAndroid.request(audioPermission, {
        title: 'Microphone Permission',
        message: 'For this app work properly, we will need access to your microphone. Can you grant access for us?',
        buttonPositive: 'Yes, I do!',
        buttonNegative: "No, I'm afraid"
      })

      return granted
    }

    return result
  })
}

/**
 * This is the root component of our app.
 */
export default function App() {
  const [state, setState] = useState<RootStore | undefined>(undefined) // prettier-ignore
  useEffect(() => {
    ;(async () => {
      setupRootStore().then(setState)
    })()
  }, [])

  // Before we show the app, we have to wait for our state to be ready.
  // In the meantime, don't render anything. This will be the background
  // color set in native by rootView's background color.
  //
  // This step should be completely covered over by the splash screen though.
  //
  // You're welcome to swap in your own component to render if your boot up
  // sequence is too slow though.
  if (!state) {
    return null
  }

  const initTwilio = async () => {
    Twilio.addEventListener('deviceReady', () => {
      console.warn("ready")
      setState({...state, twilioInitialized: true, isLoading: false})
    })
    Twilio.addEventListener('deviceNotReady', error => {
      console.warn(`not ready: ${error}`)
    })

    setState({...state, isLoading: true})
    const token = await getAuthToken()
  
    if (Platform.OS === 'android') {
      await getMicrophonePermission()
    }
  
    await Twilio.initWithToken(token)
  
    if (Platform.OS === 'ios') {
      Twilio.configureCallKit({
        appName: 'Twilio Call'
      })
    }
  }

  var keyboard = React.createRef<TextInput>();
  const makeCall = (to: string) => {
    Keyboard.dismiss()
    Alert.alert(
      'Are you sure?',
      `Are we really calling ${to}?`, [
        {text: 'Hell yeah!', onPress: () => Twilio.connect({ To: to })},
        {text: 'Hmm, better not to', onPress: () => keyboard?.current?.focus()}
      ])
  }

  const renderInitialize = () => <Button onPress={initTwilio}>
    <View>
      <Text text='Initialize Twilio Call'/>
    </View>
  </Button>

  const renderMakeCal = () => <View>
    <TextField label='What number do you want to call to?'
      forwardedRef={keyboard}
      autoFocus={true}
      keyboardType='phone-pad'
      inputStyle={{borderColor: 'black', borderWidth: 1, borderRadius: 8, marginTop: 8, textAlign: 'center'}}
      onChangeText={text => {
        setState({
          ...state,
          callTo: text
        })
      }} />

    <Button disabled={!state.twilioInitialized} onPress={() => makeCall(state.callTo)} style={{backgroundColor: state.twilioInitialized ? 'blue' : color.palette.lightGrey}}>
      <View>
        <Text text='Make the call!' style={{color: 'white'}} />
      </View>
    </Button>
  </View>

  const renderContent = () => {
    if (state.twilioInitialized) {
      return renderMakeCal()
    }
    else if (state.isLoading) {
      return <ActivityIndicator />
    }
    else {
      return renderInitialize()
    }
  }

  // otherwise, we're ready to render the app
  return (
    <Screen style={{alignItems: 'center', justifyContent: 'center'}}>
      {renderContent()}
    </Screen>
  )
}
